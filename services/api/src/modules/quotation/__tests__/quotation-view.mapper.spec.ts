import { PERMISSION_CODES } from '@machining-erp/shared'

import { canSeeCost, toQuotationView } from '../services/quotation-view.mapper'

import type { QuotationRecord } from '../repositories/quotation.repository.port'

const RECORD: QuotationRecord = {
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
  moldFeeMinor: 500_000n,
  terms: { processingMode: '包工包料', paymentTerms: '月结 60 天', allowedScrapBps: 300 },
  status: 'EFFECTIVE',
  validUntil: new Date('2026-09-07T00:00:00Z'),
  submittedBy: 'WFX-2018-0042',
  submittedAt: new Date('2026-08-08T01:00:00Z'),
  approvedBy: 'WFX-2015-0007',
  approvedAt: new Date('2026-08-08T02:00:00Z'),
  rejectReason: null,
  createdBy: 'WFX-2018-0042',
  versionLock: 3,
  items: [
    {
      id: 'QI1',
      sequence: 1,
      productName: '12K Live Front Panel',
      drawingNo: 'BCM-2607',
      drawingVersionId: 'DV1',
      revision: 'REV A',
      material: 'AL6061-T6',
      finishing: '阳极氧化',
      process: 'CNC',
      costAnalysisLineId: 'CAL1',
      remark: null,
      tiers: [
        { id: 'QT1', minQuantity: '10', unitPriceMinor: 32_000n, unitCostMinor: 27_074n, label: null },
        { id: 'QT2', minQuantity: '100', unitPriceMinor: 29_000n, unitCostMinor: 27_074n, label: null },
      ],
    },
  ],
}

const SALES_PERMS = [PERMISSION_CODES.SALES_OPERATE]
const ENGINEER_PERMS = [PERMISSION_CODES.COSTING_EDIT]

describe('报价单对外表示', () => {
  it('金额一律定点字符串 + 币种', () => {
    const view = toQuotationView(RECORD, SALES_PERMS)

    expect(view.items[0]?.tiers[0]?.unitPrice).toEqual({ amount: '320.00', currency: 'CNY' })
    expect(view.moldFee).toEqual({ amount: '5000.00', currency: 'CNY' })
  })

  it('模具费与单件价并列，不摊进任何一档', () => {
    const view = toQuotationView(RECORD, SALES_PERMS)

    expect(view.items[0]?.tiers.map((tier) => tier.unitPrice.amount)).toEqual(['320.00', '290.00'])
  })

  it('业务员看不到成本与毛利：整组字段缺席而不是给 0', () => {
    const view = toQuotationView(RECORD, SALES_PERMS)

    expect(view.items[0]?.tiers[0]?.cost).toBeUndefined()
    expect(Object.keys(view.items[0]?.tiers[0] ?? {})).not.toContain('cost')
    expect(JSON.stringify(view)).not.toContain('unitCost')
  })

  it('报价工程师能看到成本与毛利率', () => {
    const view = toQuotationView(RECORD, ENGINEER_PERMS)

    expect(view.items[0]?.tiers[0]?.cost?.unitCost).toEqual({ amount: '270.74', currency: 'CNY' })
    // (32000 − 27074) / 32000 = 15.39%
    expect(view.items[0]?.tiers[0]?.cost?.grossMarginBps).toBe(1539)
  })

  it('审核人也要看得到成本，否则无从判断该不该批', () => {
    expect(canSeeCost([PERMISSION_CODES.QUOTE_APPROVE])).toBe(true)
    expect(canSeeCost(SALES_PERMS)).toBe(false)
  })

  it('报价为 0 时毛利率按 0 处理而不是除零', () => {
    const zero = structuredCloneRecord()
    zero.items[0]!.tiers[0]!.unitPriceMinor = 0n
    const view = toQuotationView(zero, ENGINEER_PERMS)

    expect(view.items[0]?.tiers[0]?.cost?.grossMarginBps).toBe(0)
  })

  it('时间一律 ISO 字符串，无值为 null', () => {
    const view = toQuotationView(RECORD, SALES_PERMS)

    expect(view.approvedAt).toBe('2026-08-08T02:00:00.000Z')
    expect(view.validUntil).toBe('2026-09-07T00:00:00.000Z')
    expect(view.fxQuotedOn).toBeNull()
    expect(view.fxRate).toBeNull()
  })

  it('国外报价的汇率快照转成小数展示', () => {
    const overseas = structuredCloneRecord()
    overseas.template = 'OVERSEAS'
    overseas.currency = 'USD'
    overseas.fxRateMicros = 139_500n
    overseas.fxQuotedOn = new Date('2026-08-08T00:00:00Z')

    const view = toQuotationView(overseas, SALES_PERMS)
    expect(view.fxRate).toBeCloseTo(0.1395, 10)
    expect(view.items[0]?.tiers[0]?.unitPrice.currency).toBe('USD')
  })

  it('条款原样透出供模板渲染', () => {
    const view = toQuotationView(RECORD, SALES_PERMS)

    expect(view.terms).toEqual({
      processingMode: '包工包料',
      paymentTerms: '月结 60 天',
      allowedScrapBps: 300,
    })
  })
})

/** 结构化深拷贝：bigint 与 Date 都要原样保留，所以不能用 JSON round-trip。 */
function structuredCloneRecord(): QuotationRecord {
  return {
    ...RECORD,
    items: RECORD.items.map((item) => ({ ...item, tiers: item.tiers.map((tier) => ({ ...tier })) })),
  }
}
