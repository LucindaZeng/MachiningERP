import { toBomRequestDraft } from '../services/bom-request-input.mapper'
import { toBomRequestView } from '../services/bom-request-view.mapper'

import type { BomRequestPayloadDto } from '../dto/bom-request-payload.dto'
import type { BomRequestRecord } from '../repositories/bom-request.repository.port'

const DTO: BomRequestPayloadDto = {
  customerId: 'CU1',
  quotationId: 'Q1',
  quotationItemId: 'QI1',
  drawingVersionId: 'DV1',
  productName: '直线导轨安装座',
  drawingNo: 'MT-7719',
  drawingVersion: 'Rev.B',
  material: '45# 钢',
  surfaceTreatment: '发黑',
  inspection: '首件 + 抽检 AQL 1.0',
  packing: '气泡袋 + 纸箱 50 件/箱',
  quantity: '500',
  productionType: 'BATCH',
}

describe('入参映射', () => {
  it('申请人取当前登录用户，不接受调用方指定', () => {
    const draft = toBomRequestDraft(DTO, 'WFX-2018-0042')
    expect(draft.ownerUserCode).toBe('WFX-2018-0042')
  })

  it('可选字段缺省一律落成 null', () => {
    const draft = toBomRequestDraft(DTO, 'WFX-2018-0042')

    expect(draft).toMatchObject({
      customerPoNo: null,
      targetDeliveryDate: null,
      fromSampleNo: null,
      specialRequirement: null,
    })
  })

  it('传了就原样带上，日期转 Date', () => {
    const draft = toBomRequestDraft(
      {
        ...DTO,
        customerPoNo: 'MT-PO-1',
        targetDeliveryDate: '2026-08-25T00:00:00.000Z',
        fromSampleNo: 'SMP0001',
        specialRequirement: '平面度 0.02',
      },
      'WFX-2018-0042',
    )

    expect(draft.customerPoNo).toBe('MT-PO-1')
    expect(draft.targetDeliveryDate).toEqual(new Date('2026-08-25T00:00:00.000Z'))
    expect(draft.fromSampleNo).toBe('SMP0001')
    expect(draft.specialRequirement).toBe('平面度 0.02')
  })
})

const RECORD: BomRequestRecord = {
  id: 'BR1',
  docNo: 'BOMR0001',
  customerId: 'CU1',
  quotationId: 'Q1',
  quotationItemId: 'QI1',
  customerPoNo: null,
  productName: '直线导轨安装座',
  drawingNo: 'MT-7719',
  drawingVersionId: 'DV1',
  drawingVersion: 'Rev.B',
  material: '45# 钢',
  surfaceTreatment: '发黑',
  inspection: '首件',
  packing: '纸箱',
  quantity: '500',
  targetDeliveryDate: null,
  productionType: 'BATCH',
  fromSampleNo: null,
  specialRequirement: null,
  status: 'SUBMITTED',
  ownerUserCode: 'WFX-2018-0042',
  submittedAt: null,
  claimedAt: null,
  claimedBy: null,
  returnedMs: 0n,
  returnedAt: null,
  returnReason: null,
  bomReady: false,
  programReady: false,
  bomReadyAt: null,
  programReadyAt: null,
  productCode: null,
  versionLock: 0,
}

describe('对外表示', () => {
  it('全空时时间字段一律 null，不是 undefined', () => {
    const view = toBomRequestView(RECORD)

    expect(view.targetDeliveryDate).toBeNull()
    expect(view.submittedAt).toBeNull()
    expect(view.claimedAt).toBeNull()
    expect(view.bomReadyAt).toBeNull()
    expect(view.programReadyAt).toBeNull()
  })

  it('有值时全部转 ISO 字符串', () => {
    const view = toBomRequestView({
      ...RECORD,
      targetDeliveryDate: new Date('2026-08-25T00:00:00Z'),
      submittedAt: new Date('2026-08-20T01:00:00Z'),
      claimedAt: new Date('2026-08-20T02:00:00Z'),
      bomReadyAt: new Date('2026-08-21T03:00:00Z'),
      programReadyAt: new Date('2026-08-22T04:00:00Z'),
    })

    expect(view.targetDeliveryDate).toBe('2026-08-25T00:00:00.000Z')
    expect(view.submittedAt).toBe('2026-08-20T01:00:00.000Z')
    expect(view.claimedAt).toBe('2026-08-20T02:00:00.000Z')
    expect(view.bomReadyAt).toBe('2026-08-21T03:00:00.000Z')
    expect(view.programReadyAt).toBe('2026-08-22T04:00:00.000Z')
  })

  it('退回等待毫秒转成小时，保留两位', () => {
    const view = toBomRequestView({ ...RECORD, returnedMs: BigInt(5_400_000) })
    expect(view.returnedHours).toBe(1.5)
  })

  it('BOM 未完成时不能下单', () => {
    expect(toBomRequestView(RECORD).canPlaceOrder).toBe(false)
  })

  it('BOM_DONE 即可下单，ALL_DONE 与 ORDERED 同理', () => {
    for (const status of ['BOM_DONE', 'ALL_DONE', 'ORDERED'] as const) {
      expect(toBomRequestView({ ...RECORD, status }).canPlaceOrder).toBe(true)
    }
  })

  it('草稿、已提交、已接收、已退回都不能下单', () => {
    for (const status of ['DRAFT', 'SUBMITTED', 'CLAIMED', 'RETURNED'] as const) {
      expect(toBomRequestView({ ...RECORD, status }).canPlaceOrder).toBe(false)
    }
  })
})
