import { PERMISSION_CODES } from '@machining-erp/shared'

import { AuditService } from '../../../platform/audit'
import { DomainEventPublisher } from '../../../platform/events'
import { NotificationService } from '../../../platform/notification'
import { DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { canPlaceOrder } from '../constants/bom-request-states'
import { BomEngineeringService, deriveStatus } from '../services/bom-engineering.service'
import { toBomRequestView } from '../services/bom-request-view.mapper'
import { BomRequestService } from '../services/bom-request.service'

import { FakeBomRequestRepository } from './fakes'

import type { BomRequestDraft } from '../repositories/bom-request.repository.port'
import type { QuotationLineFacts } from '../services/bom-eligibility.rules'
import type { BomActor } from '../services/bom-request.service'

/** 生效报价 + 非样品行：默认可建 BOM */
const EFFECTIVE: QuotationLineFacts = {
  quotationStatus: 'EFFECTIVE',
  isSampleLine: false,
  quotationItemId: 'QI1',
  drawingVersionId: 'DV1',
}

const SALES: BomActor = { userCode: 'WFX-2018-0042', permissions: [PERMISSION_CODES.SALES_OPERATE] }
const ENGINEER: BomActor = {
  userCode: 'WFX-2019-0200',
  permissions: [PERMISSION_CODES.ENGINEERING_BOM_HANDLE],
}

let docSeq = 0

function build(): {
  requests: BomRequestService
  engineering: BomEngineeringService
  repo: FakeBomRequestRepository
  notify: jest.Mock
  timelineEnter: jest.Mock
  publish: jest.Mock
} {
  const repo = new FakeBomRequestRepository()
  const notify = jest.fn().mockResolvedValue(undefined)
  const timelineEnter = jest.fn().mockResolvedValue(undefined)

  const docNumber = {
    next: jest.fn(async () => `BOMR${String((docSeq += 1)).padStart(4, '0')}`),
  } as unknown as DocNumberService
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService
  const notifications = { notify } as unknown as NotificationService
  const timeline = {
    enter: timelineEnter,
    close: jest.fn().mockResolvedValue(undefined),
  } as unknown as DocTimelineService

  const publish = jest.fn().mockResolvedValue(undefined)
  const events = { publish } as unknown as DomainEventPublisher

  const requests = new BomRequestService(docNumber, audit, timeline, repo)
  const engineering = new BomEngineeringService(
    audit,
    notifications,
    timeline,
    events,
    requests,
    repo,
  )

  return { requests, engineering, repo, notify, timelineEnter, publish }
}

function draft(overrides: Partial<BomRequestDraft> = {}): BomRequestDraft {
  return {
    customerId: 'CU1',
    quotationId: 'Q1',
    quotationItemId: 'QI1',
    drawingVersionId: 'DV1',
    customerPoNo: 'MT-PO-2607119',
    productName: '直线导轨安装座',
    drawingNo: 'MT-7719',
    drawingVersion: 'Rev.B',
    material: '45# 钢',
    surfaceTreatment: '发黑',
    inspection: '首件 + 抽检 AQL 1.0',
    packing: '气泡袋 + 纸箱 50 件/箱',
    quantity: '500',
    targetDeliveryDate: new Date('2026-08-25T00:00:00Z'),
    productionType: 'BATCH',
    fromSampleNo: null,
    specialRequirement: null,
    ownerUserCode: SALES.userCode,
    ...overrides,
  }
}

describe('图纸沿用报价环节的版本，不重复上传', () => {
  it('没引用报价产品就建不了申请', async () => {
    const { requests } = build()

    await expect(
      requests.create(draft({ quotationItemId: null }), EFFECTIVE, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2402' })
  })

  it('引用了报价产品但没有图纸版本，同样挡下', async () => {
    const { requests } = build()

    await expect(
      requests.create(draft({ drawingVersionId: null }), EFFECTIVE, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2403' })
  })

  it('齐备时正常建单并取号', async () => {
    const { requests } = build()
    const record = await requests.create(draft(), EFFECTIVE, SALES)

    expect(record.docNo).toMatch(/^BOMR/)
    expect(record.status).toBe('DRAFT')
    expect(record.drawingVersionId).toBe('DV1')
  })

  it('非业务岗位提不了', async () => {
    const { requests } = build()
    await expect(requests.create(draft(), EFFECTIVE, ENGINEER)).rejects.toMatchObject({ code: 'ORD_2405' })
  })

  it('模具申请同样走这条路', async () => {
    const { requests } = build()
    const record = await requests.create(draft({ productionType: 'MOLD' }), EFFECTIVE, SALES)
    expect(record.productionType).toBe('MOLD')
  })
})

describe('BOM 可下单与程序可开工是两个独立开关', () => {
  async function claimed(): Promise<{
    harness: ReturnType<typeof build>
    id: string
    versionLock: number
  }> {
    const harness = build()
    const created = await harness.requests.create(draft(), EFFECTIVE, SALES)
    const submitted = await harness.requests.submit(created.id, created.versionLock, SALES)
    const record = await harness.engineering.claim(submitted.id, submitted.versionLock, ENGINEER)
    return { harness, id: record.id, versionLock: record.versionLock }
  }

  it('只完成 BOM 时状态是 BOM_DONE，程序开关仍是关的', async () => {
    const { harness, id, versionLock } = await claimed()
    const record = await harness.engineering.completeBom(id, versionLock, '1008010001', ENGINEER)

    expect(record.status).toBe('BOM_DONE')
    expect(record.bomReady).toBe(true)
    expect(record.programReady).toBe(false)
  })

  it('BOM 好了就能下单，不必等程序', async () => {
    const { harness, id, versionLock } = await claimed()
    const record = await harness.engineering.completeBom(id, versionLock, '1008010001', ENGINEER)

    expect(canPlaceOrder(record.status)).toBe(true)
  })

  it('只完成程序时不会跳到可下单', async () => {
    const { harness, id, versionLock } = await claimed()
    const record = await harness.engineering.completeProgram(id, versionLock, ENGINEER)

    expect(record.programReady).toBe(true)
    expect(record.bomReady).toBe(false)
    expect(record.status).toBe('CLAIMED')
    expect(canPlaceOrder(record.status)).toBe(false)
  })

  it('两个都完成才是 ALL_DONE，顺序无所谓', async () => {
    const { harness, id, versionLock } = await claimed()
    const afterProgram = await harness.engineering.completeProgram(id, versionLock, ENGINEER)
    const afterBom = await harness.engineering.completeBom(
      afterProgram.id,
      afterProgram.versionLock,
      '1008010001',
      ENGINEER,
    )

    expect(afterBom.status).toBe('ALL_DONE')
  })

  it('状态由两个开关推导，调用方无从指定', () => {
    expect(deriveStatus(false, false)).toBe('CLAIMED')
    expect(deriveStatus(true, false)).toBe('BOM_DONE')
    expect(deriveStatus(false, true)).toBe('CLAIMED')
    expect(deriveStatus(true, true)).toBe('ALL_DONE')
  })

  it('对外视图里两个开关分别透出，没有合并字段', async () => {
    const { harness, id, versionLock } = await claimed()
    const record = await harness.engineering.completeBom(id, versionLock, '1008010001', ENGINEER)
    const view = toBomRequestView(record)

    expect(view.bomReady).toBe(true)
    expect(view.programReady).toBe(false)
    expect(Object.keys(view)).not.toContain('engineeringDone')
    expect(Object.keys(view)).not.toContain('allDone')
  })

  it('BOM 完成必须回填品号', async () => {
    const { harness, id, versionLock } = await claimed()

    await expect(
      harness.engineering.completeBom(id, versionLock, '   ', ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_2408' })
  })

  it('BOM 完成后立刻通知业务员可以下单，量产说品号', async () => {
    const { harness, id, versionLock } = await claimed()
    await harness.engineering.completeBom(id, versionLock, '1008010001', ENGINEER)

    expect(harness.notify).toHaveBeenCalledTimes(1)
    expect(harness.notify).toHaveBeenLastCalledWith(
      expect.objectContaining({
        recipientUserCode: SALES.userCode,
        title: expect.stringContaining('BOM 建立完成'),
        body: expect.stringContaining('品号 1008010001'),
      }),
    )
  })

  it('只完成程序时不通知业务员——业务侧没有任何可推进的事', async () => {
    const { harness, id, versionLock } = await claimed()
    await harness.engineering.completeProgram(id, versionLock, ENGINEER)

    expect(harness.notify).not.toHaveBeenCalled()
  })

  it('模具申请的通知说模具编号', async () => {
    const harness = build()
    const created = await harness.requests.create(draft({ productionType: 'MOLD' }), EFFECTIVE, SALES)
    const submitted = await harness.requests.submit(created.id, created.versionLock, SALES)
    const claimedRecord = await harness.engineering.claim(
      submitted.id,
      submitted.versionLock,
      ENGINEER,
    )
    await harness.engineering.completeBom(
      claimedRecord.id,
      claimedRecord.versionLock,
      '1901010001',
      ENGINEER,
    )

    expect(harness.notify).toHaveBeenLastCalledWith(
      expect.objectContaining({ body: expect.stringContaining('模具编号') }),
    )
  })

  it('非工程岗位回传不了', async () => {
    const { harness, id, versionLock } = await claimed()

    await expect(
      harness.engineering.completeBom(id, versionLock, '1008010001', SALES),
    ).rejects.toMatchObject({ code: 'ORD_2406' })
  })
})

describe('工程退回与等待时长累计', () => {
  it('退回必须写明缺什么', async () => {
    const harness = build()
    const created = await harness.requests.create(draft(), EFFECTIVE, SALES)
    const submitted = await harness.requests.submit(created.id, created.versionLock, SALES)

    await expect(
      harness.engineering.returnToSales(submitted.id, submitted.versionLock, '  ', ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_2407' })
  })

  it('退回后通知业务员补料，节点按异常收尾', async () => {
    const harness = build()
    const created = await harness.requests.create(draft(), EFFECTIVE, SALES)
    const submitted = await harness.requests.submit(created.id, created.versionLock, SALES)

    const returned = await harness.engineering.returnToSales(
      submitted.id,
      submitted.versionLock,
      '缺表面处理要求',
      ENGINEER,
    )

    expect(returned.status).toBe('RETURNED')
    expect(returned.returnReason).toBe('缺表面处理要求')
    expect(harness.timelineEnter).toHaveBeenLastCalledWith(
      expect.objectContaining({ node: '业务补料', previousStatus: 'ABNORMAL' }),
    )
  })

  it('补料重提时把这一轮的等待时长累加进去', async () => {
    const harness = build()
    const created = await harness.requests.create(draft(), EFFECTIVE, SALES)
    const submitted = await harness.requests.submit(created.id, created.versionLock, SALES)
    const returned = await harness.engineering.returnToSales(
      submitted.id,
      submitted.versionLock,
      '缺表面处理要求',
      ENGINEER,
    )

    // 把退回时间往前拨两小时，模拟业务员两小时后才补齐
    const row = harness.repo.rows[0]!
    row.returnedAt = new Date(Date.now() - 2 * 3_600_000)

    const resubmitted = await harness.requests.submit(returned.id, returned.versionLock, SALES)

    expect(Number(resubmitted.returnedMs)).toBeGreaterThan(1.9 * 3_600_000)
    expect(resubmitted.returnedAt).toBeNull()
    expect(toBomRequestView(resubmitted).returnedHours).toBeGreaterThan(1.9)
  })

  it('没被退回过时等待时长是 0', async () => {
    const harness = build()
    const created = await harness.requests.create(draft(), EFFECTIVE, SALES)
    const submitted = await harness.requests.submit(created.id, created.versionLock, SALES)

    expect(toBomRequestView(submitted).returnedHours).toBe(0)
  })

  it('被退回的申请可以改内容再提', async () => {
    const harness = build()
    const created = await harness.requests.create(draft(), EFFECTIVE, SALES)
    const submitted = await harness.requests.submit(created.id, created.versionLock, SALES)
    const returned = await harness.engineering.returnToSales(
      submitted.id,
      submitted.versionLock,
      '缺表面处理',
      ENGINEER,
    )

    const updated = await harness.requests.updateDraft(
      returned.id,
      returned.versionLock,
      draft({ surfaceTreatment: '硬质阳极氧化' }),
      EFFECTIVE,
      SALES,
    )
    expect(updated.surfaceTreatment).toBe('硬质阳极氧化')
  })

  it('已接收的申请业务改不了', async () => {
    const harness = build()
    const created = await harness.requests.create(draft(), EFFECTIVE, SALES)
    const submitted = await harness.requests.submit(created.id, created.versionLock, SALES)
    const claimedRecord = await harness.engineering.claim(
      submitted.id,
      submitted.versionLock,
      ENGINEER,
    )

    await expect(
      harness.requests.updateDraft(
        claimedRecord.id,
        claimedRecord.versionLock,
        draft(),
        EFFECTIVE,
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2404' })
  })
})

describe('状态机与查询', () => {
  it('草稿不能直接被接收', async () => {
    const harness = build()
    const created = await harness.requests.create(draft(), EFFECTIVE, SALES)

    await expect(
      harness.engineering.claim(created.id, created.versionLock, ENGINEER),
    ).rejects.toMatchObject({ code: 'SYS_9012' })
  })

  it('乐观锁冲突挡下', async () => {
    const harness = build()
    const created = await harness.requests.create(draft(), EFFECTIVE, SALES)

    await expect(
      harness.requests.submit(created.id, created.versionLock + 9, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2404' })
  })

  it('申请不存在报 ORD_2400', async () => {
    const harness = build()
    await expect(harness.requests.load('nope')).rejects.toMatchObject({ code: 'ORD_2400' })
  })

  it('按客户、状态、用途、申请人过滤', async () => {
    const harness = build()
    await harness.requests.create(draft(), EFFECTIVE, SALES)
    await harness.requests.create(draft({ productionType: 'MOLD' }), EFFECTIVE, SALES)

    expect(await harness.requests.list({ limit: 50 })).toHaveLength(2)
    expect(await harness.requests.list({ productionType: 'MOLD', limit: 50 })).toHaveLength(1)
    expect(await harness.requests.list({ customerId: 'CU9', limit: 50 })).toHaveLength(0)
    expect(await harness.requests.list({ status: 'ALL_DONE', limit: 50 })).toHaveLength(0)
    expect(
      await harness.requests.list({ ownerUserCode: SALES.userCode, limit: 50 }),
    ).toHaveLength(2)
  })
})

describe('两级信号：BOM 就绪解锁下单，全部工程完成另发一条', () => {
  const BOM_READY = 'engineering.bom-request.bom-ready'
  const COMPLETED = 'engineering.bom-request.completed'

  /** 取某个事件名被发了几次 */
  function countOf(publish: jest.Mock, name: string): number {
    return publish.mock.calls.filter((call) => (call[0] as { name: string }).name === name).length
  }

  function payloadOf(publish: jest.Mock, name: string): Record<string, unknown> {
    const call = publish.mock.calls.find((item) => (item[0] as { name: string }).name === name)
    return (call?.[0] as { payload: Record<string, unknown> }).payload
  }

  async function claimed(): Promise<{
    harness: ReturnType<typeof build>
    id: string
    versionLock: number
  }> {
    const harness = build()
    const created = await harness.requests.create(draft(), EFFECTIVE, SALES)
    const submitted = await harness.requests.submit(created.id, created.versionLock, SALES)
    const record = await harness.engineering.claim(submitted.id, submitted.versionLock, ENGINEER)
    return { harness, id: record.id, versionLock: record.versionLock }
  }

  it('BOM 一完成就发 bom-ready，不等程序——程序卡的是开工不是下单', async () => {
    const { harness, id, versionLock } = await claimed()
    await harness.engineering.completeBom(id, versionLock, '1008010001', ENGINEER)

    expect(countOf(harness.publish, BOM_READY)).toBe(1)
    expect(countOf(harness.publish, COMPLETED)).toBe(0)
    expect(payloadOf(harness.publish, BOM_READY)).toMatchObject({
      quotationItemId: 'QI1',
      drawingNo: 'MT-7719',
      productCode: '1008010001',
    })
  })

  it('只完成程序时两条都不发——BOM 还没好，下单和开工都谈不上', async () => {
    const { harness, id, versionLock } = await claimed()
    await harness.engineering.completeProgram(id, versionLock, ENGINEER)

    expect(harness.publish).not.toHaveBeenCalled()
  })

  it('先 BOM 后程序：bom-ready 与 completed 各一次，不重发', async () => {
    const { harness, id, versionLock } = await claimed()
    const afterBom = await harness.engineering.completeBom(id, versionLock, '1008010001', ENGINEER)
    await harness.engineering.completeProgram(afterBom.id, afterBom.versionLock, ENGINEER)

    expect(countOf(harness.publish, BOM_READY)).toBe(1)
    expect(countOf(harness.publish, COMPLETED)).toBe(1)
  })

  it('先程序后 BOM：合上 BOM 的那一步同时发出两条，各一次', async () => {
    const { harness, id, versionLock } = await claimed()
    const afterProgram = await harness.engineering.completeProgram(id, versionLock, ENGINEER)
    expect(harness.publish).not.toHaveBeenCalled()

    await harness.engineering.completeBom(
      afterProgram.id,
      afterProgram.versionLock,
      '1008010001',
      ENGINEER,
    )

    expect(countOf(harness.publish, BOM_READY)).toBe(1)
    expect(countOf(harness.publish, COMPLETED)).toBe(1)
    expect(payloadOf(harness.publish, COMPLETED)).toMatchObject({ productCode: '1008010001' })
  })

  it('BOM 完成后不可能再走一次 completeBom，所以 bom-ready 不会重发', async () => {
    const { harness, id, versionLock } = await claimed()
    const afterBom = await harness.engineering.completeBom(id, versionLock, '1008010001', ENGINEER)

    // BOM_DONE 不能转回自身，状态机在这里兜底，不必靠标志位判重
    await expect(
      harness.engineering.completeBom(afterBom.id, afterBom.versionLock, '1008010002', ENGINEER),
    ).rejects.toMatchObject({ code: 'SYS_9012' })
    expect(countOf(harness.publish, BOM_READY)).toBe(1)
  })

  it('两条通知措辞分开：先「BOM 建立完成」解锁下单，后「全部工程完成」', async () => {
    const { harness, id, versionLock } = await claimed()
    const afterBom = await harness.engineering.completeBom(id, versionLock, '1008010001', ENGINEER)
    await harness.engineering.completeProgram(afterBom.id, afterBom.versionLock, ENGINEER)

    const titles = harness.notify.mock.calls.map((call) => (call[0] as { title: string }).title)
    expect(titles).toHaveLength(2)
    expect(titles[0]).toContain('BOM 建立完成')
    expect(titles[1]).toContain('全部工程完成')
  })
})

describe('样品与未生效报价在 service 层同样被挡', () => {
  it('样品行建不了 BOM 申请', async () => {
    const { requests } = build()

    await expect(
      requests.create(draft(), { ...EFFECTIVE, isSampleLine: true }, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2401' })
  })

  it('报价未生效建不了', async () => {
    const { requests } = build()

    await expect(
      requests.create(draft(), { ...EFFECTIVE, quotationStatus: 'DRAFT' }, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2402' })
  })
})
