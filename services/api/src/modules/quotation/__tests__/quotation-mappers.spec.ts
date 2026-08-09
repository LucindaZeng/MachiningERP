import { toQuotationDraftPayload, toTargetPrices } from '../services/quotation-input.mapper'
import { toQuotationView } from '../services/quotation-view.mapper'
import { toQuoteChangeView } from '../services/quote-change-view.mapper'

import type { CreateQuotationDto } from '../dto/create-quotation.dto'
import type { QuotationRecord } from '../repositories/quotation.repository.port'
import type { QuoteChangeRequestRecord } from '../repositories/quote-change-request.repository.port'

const DTO: CreateQuotationDto = {
  customerId: 'CU1',
  costAnalysisId: 'CA1',
  items: [
    {
      sequence: 1,
      productName: '12K Live Front Panel',
      drawingNo: 'BCM-2607',
      drawingVersionId: 'DV1',
      tiers: [{ minQuantity: '10', unitPriceMinor: '32000' }],
    },
  ],
}

describe('报价单入参映射', () => {
  it('模板、币种、模具费都有默认值', () => {
    const payload = toQuotationDraftPayload(DTO)

    expect(payload.template).toBe('DOMESTIC')
    expect(payload.currency).toBe('CNY')
    expect(payload.moldFeeMinor).toBe(0n)
    expect(payload.terms).toBeNull()
    expect(payload.fxRateMicros).toBeNull()
    expect(payload.fxQuotedOn).toBeNull()
  })

  it('可选字段缺省时一律落成 null，而不是 undefined', () => {
    const item = toQuotationDraftPayload(DTO).items[0]

    expect(item).toMatchObject({
      revision: null,
      material: null,
      finishing: null,
      process: null,
      costAnalysisLineId: null,
      remark: null,
    })
    expect(item?.tiers[0]?.label).toBeNull()
  })

  it('显式传入的表头覆盖默认值，汇率转 bigint、日期转 Date', () => {
    const payload = toQuotationDraftPayload({
      ...DTO,
      template: 'OVERSEAS',
      currency: 'USD',
      fxRateMicros: '139500',
      fxQuotedOn: '2026-08-08T00:00:00.000Z',
      moldFeeMinor: '500000',
      terms: { processingMode: '来料加工' },
    })

    expect(payload.template).toBe('OVERSEAS')
    expect(payload.fxRateMicros).toBe(139_500n)
    expect(payload.fxQuotedOn).toEqual(new Date('2026-08-08T00:00:00.000Z'))
    expect(payload.moldFeeMinor).toBe(500_000n)
    expect(payload.terms).toEqual({ processingMode: '来料加工' })
  })

  it('明细里的可选字段传了就原样带上', () => {
    const payload = toQuotationDraftPayload({
      ...DTO,
      items: [
        {
          ...DTO.items[0]!,
          revision: 'REV A',
          material: 'AL6061-T6',
          finishing: '阳极氧化',
          process: 'CNC',
          costAnalysisLineId: 'CAL1',
          remark: '含丝印',
          tiers: [{ minQuantity: '10', unitPriceMinor: '32000', label: '首单价' }],
        },
      ],
    })

    expect(payload.items[0]).toMatchObject({
      revision: 'REV A',
      material: 'AL6061-T6',
      finishing: '阳极氧化',
      process: 'CNC',
      costAnalysisLineId: 'CAL1',
      remark: '含丝印',
    })
    expect(payload.items[0]?.tiers[0]?.label).toBe('首单价')
  })

  it('缺图纸时 drawingVersionId 落成 null，由 service 去挡', () => {
    const payload = toQuotationDraftPayload({
      ...DTO,
      items: [{ ...DTO.items[0]!, drawingVersionId: undefined }],
    })

    expect(payload.items[0]?.drawingVersionId).toBeNull()
  })

  it('超出 2^53 的分值走字符串不丢精度', () => {
    const huge = '9007199254740993'
    const payload = toQuotationDraftPayload({
      ...DTO,
      items: [{ ...DTO.items[0]!, tiers: [{ minQuantity: '1', unitPriceMinor: huge }] }],
    })

    expect(payload.items[0]?.tiers[0]?.unitPriceMinor.toString()).toBe(huge)
  })

  it('目标价映射同样把分值转 bigint', () => {
    const targets = toTargetPrices([
      { itemSequence: 1, minQuantity: '100', targetPriceMinor: '26000' },
    ])

    expect(targets).toEqual([
      { itemSequence: 1, minQuantity: '100', targetPriceMinor: 26_000n },
    ])
  })
})

const REQUEST: QuoteChangeRequestRecord = {
  id: 'QCR1',
  requestNo: 'QCR202608080001',
  quotationId: 'Q1',
  targetPrices: [{ itemSequence: 1, minQuantity: '100', targetPriceMinor: 26_000n }],
  reason: '客户压价到 260 元',
  status: 'REJECTED',
  submittedBy: 'WFX-2018-0042',
  submittedAt: new Date('2026-08-08T02:00:00Z'),
  handledBy: 'WFX-2019-0113',
  handledAt: new Date('2026-08-08T03:00:00Z'),
  rejectReason: '材料价已到底',
  revisedCostAnalysisId: null,
  versionLock: 1,
}

describe('修改申请对外表示', () => {
  it('目标价转成定点字符串 + 币种', () => {
    const view = toQuoteChangeView(REQUEST, 'CNY')

    expect(view.targetPrices[0]?.targetPrice).toEqual({ amount: '260.00', currency: 'CNY' })
  })

  it('驳回理由原样透出，时间转 ISO', () => {
    const view = toQuoteChangeView(REQUEST, 'CNY')

    expect(view.rejectReason).toBe('材料价已到底')
    expect(view.handledAt).toBe('2026-08-08T03:00:00.000Z')
    expect(view.submittedAt).toBe('2026-08-08T02:00:00.000Z')
  })

  it('未处理时 handledAt 为 null', () => {
    const view = toQuoteChangeView({ ...REQUEST, status: 'SUBMITTED', handledAt: null }, 'CNY')

    expect(view.handledAt).toBeNull()
    expect(view.status).toBe('SUBMITTED')
  })

  it('币种跟随报价单', () => {
    expect(toQuoteChangeView(REQUEST, 'USD').targetPrices[0]?.targetPrice.currency).toBe('USD')
  })
})

describe('草稿态报价单的时间字段', () => {
  const DRAFT: QuotationRecord = {
    id: 'Q1',
    docNo: 'QTN202608080001',
    version: 1,
    rootId: null,
    customerId: 'CU1',
    costAnalysisId: 'CA1',
    template: 'DOMESTIC',
    currency: 'CNY',
    fxRateMicros: null,
    fxQuotedOn: null,
    moldFeeMinor: 0n,
    terms: null,
    status: 'DRAFT',
    validUntil: null,
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    rejectReason: null,
    createdBy: 'WFX-2018-0042',
    versionLock: 0,
    items: [],
  }

  it('还没送审时时间字段全是 null，不是 undefined', () => {
    const view = toQuotationView(DRAFT, [])

    expect(view.submittedAt).toBeNull()
    expect(view.approvedAt).toBeNull()
    expect(view.validUntil).toBeNull()
    expect(view.fxQuotedOn).toBeNull()
    expect(view.fxRate).toBeNull()
    expect(view.items).toEqual([])
  })
})
