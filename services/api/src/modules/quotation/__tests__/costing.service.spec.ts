import { PERMISSION_CODES } from '@machining-erp/shared'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DocNumberService } from '../../../platform/numbering'
import { CostingService, type CostingActor } from '../services/costing.service'

import { FakeCostAnalysisRepository, LINE_ROW_1, LINE_ROW_3 } from './fakes'

const ENGINEER: CostingActor = {
  userCode: 'WFX-2019-0113',
  permissions: [PERMISSION_CODES.COSTING_EDIT],
}
/** 业务员：能提报价申请，但**不能**做成本分析 */
const SALES: CostingActor = {
  userCode: 'WFX-2018-0042',
  permissions: [PERMISSION_CODES.SALES_OPERATE, PERMISSION_CODES.QUOTE_APPROVE],
}

function build(): {
  service: CostingService
  repository: FakeCostAnalysisRepository
  notify: jest.Mock
} {
  const repository = new FakeCostAnalysisRepository()
  const notify = jest.fn().mockResolvedValue(undefined)

  const service = new CostingService(
    { next: jest.fn().mockResolvedValue('CST202608080001') } as unknown as DocNumberService,
    { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
    { notify } as unknown as NotificationService,
    repository,
  )
  return { service, repository, notify }
}

const INPUT = {
  customerId: 'CU1',
  productModel: 'BCM-2607',
  lines: [LINE_ROW_1, LINE_ROW_3],
}

describe('成本分析只有报价工程师能做', () => {
  it('报价工程师可以建', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)

    expect(record.docNo).toBe('CST202608080001')
    expect(record.preparedBy).toBe('WFX-2019-0113')
    expect(record.lines).toHaveLength(2)
  })

  it('业务员建不了，报 ORD_2201', async () => {
    const { service } = build()
    await expect(service.create(INPUT, SALES)).rejects.toMatchObject({
      code: 'ORD_2201',
      status: 403,
    })
  })

  it('业务员也改不了行', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)

    await expect(
      service.replaceLines(record.id, record.versionLock, [LINE_ROW_1], SALES),
    ).rejects.toMatchObject({ code: 'ORD_2201' })
  })

  it('业务员也不能标记核价完成', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)

    await expect(service.complete(record.id, 'WFX-2018-0042', SALES)).rejects.toMatchObject({
      code: 'ORD_2201',
    })
  })

  it('角色闸门在 service 层，不依赖 controller 守卫', () => {
    expect(() => CostingService.assertQuoteEngineer(SALES)).toThrow(BizError)
    expect(() => CostingService.assertQuoteEngineer(ENGINEER)).not.toThrow()
  })
})

describe('默认比率与工艺列', () => {
  it('不传时用样例表的默认：损耗 5% / 管理费 5% / 税 13%', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)

    expect(record).toMatchObject({ lossBps: 500, overheadBps: 500, vatBps: 1300, currency: 'CNY' })
    expect(record.processColumns.map((column) => column.label)).toContain('打磨去毛刺')
  })

  it('比率可调', async () => {
    const { service } = build()
    const record = await service.create({ ...INPUT, lossBps: 800, overheadBps: 300 }, ENGINEER)

    expect(record).toMatchObject({ lossBps: 800, overheadBps: 300 })
  })

  it('工艺列可自定义', async () => {
    const { service } = build()
    const columns = [{ key: 'heat', label: '热处理' }]
    const record = await service.create({ ...INPUT, processColumns: columns }, ENGINEER)

    expect(record.processColumns).toEqual(columns)
  })
})

describe('算总口径与样例表一致', () => {
  it('totalsOf 用表内的行算出 270.74 + 13.22', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)
    const totals = service.totalsOf(record)

    expect(totals.lines[0]?.total.minor).toBe(27074n)
    expect(totals.lines[1]?.total.minor).toBe(1322n)
    // 270.740925 + 13.22118 = 283.962105 → 283.96
    expect(totals.total.minor).toBe(28396n)
  })
})

describe('核价完成后通知业务员生成报价单', () => {
  it('通知发给发起询价的业务员', async () => {
    const { service, notify } = build()
    const record = await service.create(INPUT, ENGINEER)

    await service.complete(record.id, 'WFX-2018-0042', ENGINEER)

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserCode: 'WFX-2018-0042',
        category: 'COST_ANALYSIS_DONE',
        title: expect.stringContaining('BCM-2607'),
      }),
    )
  })

  it('完成后状态变 COMPLETED', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)

    const completed = await service.complete(record.id, 'WFX-2018-0042', ENGINEER)
    expect(completed.status).toBe('COMPLETED')
  })
})

describe('锁版后不能再改', () => {
  it('已锁版的成本分析改行会被拦下', async () => {
    const { service, repository } = build()
    const record = await service.create(INPUT, ENGINEER)
    await repository.markLocked(record.id)

    await expect(
      service.replaceLines(record.id, record.versionLock, [LINE_ROW_1], ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_2202' })
  })

  it('乐观锁冲突同样拦下', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)

    await expect(
      service.replaceLines(record.id, record.versionLock + 99, [LINE_ROW_1], ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_2202' })
  })

  it('不存在的成本分析报 404', async () => {
    const { service } = build()
    await expect(service.load('MISSING')).rejects.toMatchObject({ code: 'ORD_2200', status: 404 })
  })
})

describe('改行与派生新版本', () => {
  it('整表替换成功后版本号自增，明细整体换掉', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)

    const updated = await service.replaceLines(
      record.id,
      record.versionLock,
      [LINE_ROW_3],
      ENGINEER,
    )

    expect(updated.lines).toHaveLength(1)
    expect(updated.lines[0]?.blankType).toBe('型材')
    expect(updated.versionLock).toBe(record.versionLock + 1)
  })

  it('核价完成时撞上乐观锁冲突会拦下，而不是静默跳过', async () => {
    const { service, repository } = build()
    const record = await service.create(INPUT, ENGINEER)
    // 模拟并发：别人先改了一版，手里的 versionLock 已经过期
    await repository.replaceLines(record.id, record.versionLock, [LINE_ROW_1])
    jest.spyOn(repository, 'findById').mockResolvedValueOnce({ ...record, versionLock: 0 })

    await expect(service.complete(record.id, 'WFX-2018-0042', ENGINEER)).rejects.toMatchObject({
      code: 'ORD_2202',
    })
  })

  it('派生新版本：version+1、rootId 指向初版、明细复制且行 id 是新的', async () => {
    const { service, repository } = build()
    const root = await service.create(INPUT, ENGINEER)

    const revised = await service.reviseFrom(root.id, null, ENGINEER)

    expect(revised.version).toBe(2)
    expect(revised.rootId).toBe(root.id)
    expect(revised.lines).toHaveLength(2)
    expect(revised.lines.map((line) => line.id)).not.toEqual(root.lines.map((line) => line.id))
    expect(repository.rows).toHaveLength(2)
  })

  it('再派生一次时 rootId 仍然指向初版，不会变成链式指向上一版', async () => {
    const { service } = build()
    const root = await service.create(INPUT, ENGINEER)
    const second = await service.reviseFrom(root.id, null, ENGINEER)
    const third = await service.reviseFrom(second.id, null, ENGINEER)

    expect(third.rootId).toBe(root.id)
    expect(third.version).toBe(3)
  })

  it('可以带着改好的明细直接派生', async () => {
    const { service } = build()
    const root = await service.create(INPUT, ENGINEER)

    const revised = await service.reviseFrom(root.id, [LINE_ROW_3], ENGINEER)
    expect(revised.lines).toHaveLength(1)
  })

  it('业务员派生不了新版本', async () => {
    const { service } = build()
    const root = await service.create(INPUT, ENGINEER)

    await expect(service.reviseFrom(root.id, null, SALES)).rejects.toMatchObject({
      code: 'ORD_2201',
    })
  })

  it('锁版后仍可派生新版本——这正是改价的唯一出口', async () => {
    const { service } = build()
    const root = await service.create(INPUT, ENGINEER)
    await service.lock(root.id)

    const revised = await service.reviseFrom(root.id, null, ENGINEER)
    expect(revised.status).toBe('DRAFT')
  })
})
