import { PERMISSION_CODES } from '@machining-erp/shared'

import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DocNumberService } from '../../../platform/numbering'
import { calculateCostLine } from '../services/cost-analysis-calculator'
import { formatBps, validateCostRates } from '../services/cost-rate-rules'
import { CostingService, type CostingActor } from '../services/costing.service'
import { resolveUnitCosts } from '../services/unit-cost'

import { FakeCostAnalysisRepository, LINE_ROW_1, LINE_ROW_3 } from './fakes'

const ENGINEER: CostingActor = {
  userCode: 'WFX-2019-0113',
  permissions: [PERMISSION_CODES.COSTING_EDIT],
}
const SALES: CostingActor = {
  userCode: 'WFX-2018-0042',
  permissions: [PERMISSION_CODES.SALES_OPERATE],
}

/** 7% 损耗 + 10% 管理费：客户明确说明的合法组合之一 */
const SEVEN_TEN = { lossBps: 700, overheadBps: 1000, vatBps: 1300 }

function build(): { service: CostingService; repository: FakeCostAnalysisRepository; audit: jest.Mock } {
  const repository = new FakeCostAnalysisRepository()
  const audit = jest.fn().mockResolvedValue(undefined)

  const service = new CostingService(
    { next: jest.fn().mockResolvedValue('CST202608080001') } as unknown as DocNumberService,
    { record: audit } as unknown as AuditService,
    { notify: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationService,
    repository,
  )
  return { service, repository, audit }
}

const INPUT = { customerId: 'CU1', productModel: 'BCM-2607', lines: [LINE_ROW_1, LINE_ROW_3] }

describe('费率是可调的，5%/5% 只是默认值', () => {
  it('建单就能带 7% 损耗 + 10% 管理费', async () => {
    const { service } = build()
    const record = await service.create({ ...INPUT, ...SEVEN_TEN }, ENGINEER)

    expect(record).toMatchObject({ lossBps: 700, overheadBps: 1000, vatBps: 1300 })
  })

  it('建好之后仍可改费率', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)

    const updated = await service.updateRates(record.id, record.versionLock, SEVEN_TEN, ENGINEER)

    expect(updated).toMatchObject({ lossBps: 700, overheadBps: 1000 })
    expect(updated.versionLock).toBe(record.versionLock + 1)
  })

  it('改完费率后合计随之变化：270.74 → 289.04（样例表第 1 行）', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)
    expect(service.totalsOf(record).lines[0]?.total.minor).toBe(27_074n)

    const updated = await service.updateRates(record.id, record.versionLock, SEVEN_TEN, ENGINEER)
    const totals = service.totalsOf(updated)

    // 小计 245.57 → 损耗 17.1899 → 管理费 (245.57+17.1899)×10% = 26.27599 → 合计 289.03589
    expect(totals.lines[0]?.total.minor).toBe(28_904n)
    expect(totals.lines[0]?.loss.minor).toBe(1_719n)
    expect(totals.lines[0]?.overhead.minor).toBe(2_628n)
    // 含税 289.03589 × 1.13 = 326.6105557
    expect(totals.lines[0]?.totalWithVat.minor).toBe(32_661n)
  })

  it('第 3 行同样跟着变：13.22 → 14.11', async () => {
    const { service } = build()
    const record = await service.create({ ...INPUT, ...SEVEN_TEN }, ENGINEER)

    expect(service.totalsOf(record).lines[1]?.total.minor).toBe(1_411n)
  })

  it('管理费仍按「小计 + 损耗」取，换了费率也不改口径', () => {
    const base = calculateCostLine(LINE_ROW_1, { ...SEVEN_TEN, currency: 'CNY' })

    // 若错写成对小计单独取 10%，管理费会是 24.557 而不是 26.27599
    expect(base.overhead.minor).toBe(2_628n)
    expect(base.overhead.minor).not.toBe(2_456n)
  })

  it('单件成本跟着费率走，报价的成本基准不会停留在旧费率上', async () => {
    const { service, repository } = build()
    const record = await service.create(INPUT, ENGINEER)
    await service.updateRates(record.id, record.versionLock, SEVEN_TEN, ENGINEER)

    const reloaded = repository.rows[0]!
    expect(resolveUnitCosts(reloaded).get(reloaded.lines[0]!.id)).toBe(28_904n)
  })
})

describe('费率闸门', () => {
  it('业务员改不了费率', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)

    await expect(
      service.updateRates(record.id, record.versionLock, SEVEN_TEN, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2201', status: 403 })
  })

  it('锁版之后费率也改不动了', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)
    await service.lock(record.id)

    await expect(
      service.updateRates(record.id, record.versionLock, SEVEN_TEN, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_2202' })
  })

  it('乐观锁冲突同样拦下', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)

    await expect(
      service.updateRates(record.id, record.versionLock + 9, SEVEN_TEN, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_2202' })
  })

  it('负费率被挡下', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)

    await expect(
      service.updateRates(record.id, 0, { ...SEVEN_TEN, lossBps: -100 }, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_2204', message: expect.stringContaining('不能为负') })
  })

  it('把 7% 误填成 700% 会被拦住并提示少打小数点', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)

    await expect(
      service.updateRates(record.id, 0, { ...SEVEN_TEN, overheadBps: 70_000 }, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_2204', message: expect.stringContaining('小数点') })
  })

  it('非整数万分比被挡下——万分比本来就是为了避开浮点', async () => {
    const { service } = build()
    const record = await service.create(INPUT, ENGINEER)

    await expect(
      service.updateRates(record.id, 0, { ...SEVEN_TEN, lossBps: 5.5 }, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_2204', message: expect.stringContaining('万分比整数') })
  })

  it('建单时带非法费率同样建不出来', async () => {
    const { service } = build()

    await expect(service.create({ ...INPUT, lossBps: -1 }, ENGINEER)).rejects.toMatchObject({
      code: 'ORD_2204',
    })
  })

  it('三项都错时一次性列全，不用改一次报一次', () => {
    const issues = validateCostRates({ lossBps: -1, overheadBps: 99_999, vatBps: 1.5 })

    expect(issues.map((issue) => issue.field)).toEqual(['lossBps', 'overheadBps', 'vatBps'])
  })

  it('0% 是合法的（不收管理费的场景）', () => {
    expect(validateCostRates({ lossBps: 0, overheadBps: 0, vatBps: 0 })).toEqual([])
  })

  it('100% 是上限，恰好 100% 放行', () => {
    expect(validateCostRates({ lossBps: 10_000, overheadBps: 10_000, vatBps: 10_000 })).toEqual([])
  })
})

describe('费率改动留痕', () => {
  it('审计记的是可读百分比，不是要人心算的万分比', async () => {
    const { service, audit } = build()
    const record = await service.create(INPUT, ENGINEER)
    audit.mockClear()

    await service.updateRates(record.id, record.versionLock, SEVEN_TEN, ENGINEER)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cost-analysis.update-rates',
        actorUserCode: ENGINEER.userCode,
        before: { loss: '5%', overhead: '5%', vat: '13%' },
        after: { loss: '7%', overhead: '10%', vat: '13%' },
      }),
    )
  })

  it('带小数的费率也格式化得出来', () => {
    expect(formatBps(1_050)).toBe('10.5%')
    expect(formatBps(725)).toBe('7.25%')
    expect(formatBps(0)).toBe('0%')
    expect(formatBps(10_000)).toBe('100%')
  })
})

describe('重核时顺带调费率', () => {
  it('派生新版本可以直接换一套费率，原版本不受影响', async () => {
    const { service, repository } = build()
    const root = await service.create(INPUT, ENGINEER)

    const revised = await service.reviseFrom(root.id, null, ENGINEER, SEVEN_TEN)

    expect(revised).toMatchObject({ version: 2, lossBps: 700, overheadBps: 1000 })
    expect(repository.rows[0]).toMatchObject({ lossBps: 500, overheadBps: 500 })
  })

  it('不传费率就沿用原版本的费率', async () => {
    const { service } = build()
    const root = await service.create({ ...INPUT, ...SEVEN_TEN }, ENGINEER)

    const revised = await service.reviseFrom(root.id, null, ENGINEER)
    expect(revised).toMatchObject({ lossBps: 700, overheadBps: 1000 })
  })

  it('重核时带非法费率同样派生不出新版本', async () => {
    const { service, repository } = build()
    const root = await service.create(INPUT, ENGINEER)

    await expect(
      service.reviseFrom(root.id, null, ENGINEER, { ...SEVEN_TEN, vatBps: -1 }),
    ).rejects.toMatchObject({ code: 'ORD_2204' })
    expect(repository.rows).toHaveLength(1)
  })
})
