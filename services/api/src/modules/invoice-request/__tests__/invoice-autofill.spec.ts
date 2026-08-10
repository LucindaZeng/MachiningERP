import { checkAmountMatch, remainingCreditable } from '../services/invoice-amount-match'
import {
  VAT_RATE_BPS,
  ZERO_RATE_BPS,
  autofillInvoice,
  lineTaxMinor,
  paymentTermDays,
  resolveInvoiceKind,
  taxRateBpsFor,
} from '../services/invoice-autofill'

import type { InvoiceCustomerFacts, InvoiceLineFacts } from '../services/invoice-autofill'

const DOMESTIC: InvoiceCustomerFacts = {
  region: 'DOMESTIC',
  invoiceType: 'SPECIAL',
  title: '苏州明泰自动化设备有限公司',
  taxNo: '9132050XXXXXXXXXX1J',
  bankAccount: '中国银行苏州工业园区支行 4582 **** 1108',
  invoiceAddress: '苏州工业园区星龙街 128 号',
  ownerEmail: 'finance@mingtai-auto.com',
  paymentTerm: 'NET_60',
  currency: 'CNY',
}

const LINES: InvoiceLineFacts[] = [
  {
    shipmentId: 'S1',
    shipmentNo: 'SHP-20260706-0046',
    productName: '导轨压板',
    drawingNo: 'MT-7601',
    quantity: '800',
    unitPriceMinor: 3_980n,
    amountMinor: 3_184_000n,
  },
  {
    shipmentId: 'S2',
    shipmentNo: 'SHP-20260715-0051',
    productName: '直线导轨安装座',
    drawingNo: 'MT-7719',
    quantity: '2000',
    unitPriceMinor: 4_620n,
    amountMinor: 9_240_000n,
  },
]

const ISSUED_ON = new Date('2026-07-28T00:00:00Z')

describe('发票种类来自客户档案', () => {
  it('国内客户 + 档案设了专票 → 专票', () => {
    expect(resolveInvoiceKind(DOMESTIC)).toBe('SPECIAL')
  })

  it('国内客户 + 档案设了普票 → 普票', () => {
    expect(resolveInvoiceKind({ ...DOMESTIC, invoiceType: 'GENERAL' })).toBe('GENERAL')
  })

  it('国内客户档案没设 → 按普票兜底，开错的补救成本比专票低得多', () => {
    expect(resolveInvoiceKind({ ...DOMESTIC, invoiceType: null })).toBe('GENERAL')
  })

  it.each(['HK_MO_TW', 'OVERSEAS'] as const)('%s 客户一律出口发票', (region) => {
    expect(resolveInvoiceKind({ ...DOMESTIC, region })).toBe('EXPORT')
  })

  it('境外客户即使档案写了专票也还是出口票', () => {
    expect(resolveInvoiceKind({ ...DOMESTIC, region: 'OVERSEAS', invoiceType: 'SPECIAL' })).toBe(
      'EXPORT',
    )
  })
})

describe('税率跟着发票种类走', () => {
  it.each([
    ['SPECIAL', VAT_RATE_BPS],
    ['GENERAL', VAT_RATE_BPS],
    ['EXPORT', ZERO_RATE_BPS],
    ['PROFORMA', ZERO_RATE_BPS],
  ] as const)('%s → %s bps', (kind, expected) => {
    expect(taxRateBpsFor(kind)).toBe(expected)
  })

  it('行税额按 13% 算并取整到分', () => {
    expect(lineTaxMinor(3_184_000n, VAT_RATE_BPS)).toBe(413_920n)
  })

  it('零税率行税额为 0', () => {
    expect(lineTaxMinor(3_784_200n, ZERO_RATE_BPS)).toBe(0n)
  })

  it('除不尽时四舍五入到分，不留下小数', () => {
    // 1 分 × 13% = 0.13 分 → 0
    expect(lineTaxMinor(1n, VAT_RATE_BPS)).toBe(0n)
    // 100 分 × 13% = 13 分
    expect(lineTaxMinor(100n, VAT_RATE_BPS)).toBe(13n)
  })
})

describe('账期决定预计回款日', () => {
  it.each([
    ['NET_30', 30],
    ['NET_60', 60],
    ['NET_90', 90],
    ['CASH_BEFORE_SHIPMENT', 0],
    ['DEPOSIT_THEN_BALANCE', 0],
  ] as const)('%s → %s 天', (term, days) => {
    expect(paymentTermDays(term)).toBe(days)
  })
})

describe('整单带出', () => {
  it('金额逐行汇总，含税 = 不含税 + 税额', () => {
    const filled = autofillInvoice(DOMESTIC, LINES, ISSUED_ON)

    expect(filled.amountExTaxMinor).toBe(12_424_000n)
    expect(filled.taxAmountMinor).toBe(1_615_120n)
    expect(filled.amountIncTaxMinor).toBe(14_039_120n)
  })

  it('行号从 1 连续编，税率逐行落下来', () => {
    const filled = autofillInvoice(DOMESTIC, LINES, ISSUED_ON)

    expect(filled.lines.map((line) => line.sequence)).toEqual([1, 2])
    expect(filled.lines.every((line) => line.taxRateBps === VAT_RATE_BPS)).toBe(true)
  })

  it('开票信息原样冻结自客户档案', () => {
    const filled = autofillInvoice(DOMESTIC, LINES, ISSUED_ON)

    expect(filled).toMatchObject({
      title: '苏州明泰自动化设备有限公司',
      taxNo: '9132050XXXXXXXXXX1J',
      address: '苏州工业园区星龙街 128 号',
    })
  })

  it('有邮箱走电子发票，没邮箱只能寄纸质件', () => {
    expect(autofillInvoice(DOMESTIC, LINES, ISSUED_ON).deliveryMethod).toBe('电子发票（邮箱）')

    const noEmail = autofillInvoice({ ...DOMESTIC, ownerEmail: null }, LINES, ISSUED_ON)
    expect(noEmail.deliveryMethod).toBe('纸质发票（快递）')
    expect(noEmail.deliveryTarget).toBe(DOMESTIC.invoiceAddress)
  })

  it('没有税号时落空串而不是 undefined，DTO 那层不用再兜一次', () => {
    expect(autofillInvoice({ ...DOMESTIC, taxNo: null }, LINES, ISSUED_ON).taxNo).toBe('')
  })

  it('预计回款日 = 开票日 + 账期', () => {
    const filled = autofillInvoice(DOMESTIC, LINES, ISSUED_ON)
    expect(filled.expectedPaymentDate?.toISOString().slice(0, 10)).toBe('2026-09-26')
  })

  it('现金客户当日到期', () => {
    const cash = autofillInvoice(
      { ...DOMESTIC, paymentTerm: 'CASH_BEFORE_SHIPMENT' },
      LINES,
      ISSUED_ON,
    )
    expect(cash.expectedPaymentDate?.toISOString().slice(0, 10)).toBe('2026-07-28')
  })

  it('出口客户整单零税，含税等于不含税', () => {
    const exported = autofillInvoice({ ...DOMESTIC, region: 'OVERSEAS' }, LINES, ISSUED_ON)

    expect(exported.invoiceKind).toBe('EXPORT')
    expect(exported.taxAmountMinor).toBe(0n)
    expect(exported.amountIncTaxMinor).toBe(exported.amountExTaxMinor)
  })

  it('没有明细时金额全为零，不炸', () => {
    const empty = autofillInvoice(DOMESTIC, [], ISSUED_ON)

    expect(empty.lines).toEqual([])
    expect(empty.amountIncTaxMinor).toBe(0n)
  })
})

describe('三方金额一致性', () => {
  const base = {
    invoiceExTaxMinor: 12_424_000n,
    shipmentTotalMinor: 12_424_000n,
    statementTotalMinor: 12_424_000n,
    currency: 'CNY',
  }

  it('三者一致 → 放行', () => {
    expect(checkAmountMatch(base)).toEqual({ matched: true, note: null })
  })

  it('与出货对不上 → 拦下并写清差多少', () => {
    const result = checkAmountMatch({ ...base, shipmentTotalMinor: 12_000_000n })

    expect(result.matched).toBe(false)
    expect(result.note).toContain('与出货金额相差 +424000')
  })

  it('与对账单对不上 → 拦下', () => {
    const result = checkAmountMatch({ ...base, statementTotalMinor: 12_901_600n })

    expect(result.matched).toBe(false)
    expect(result.note).toContain('与对账单相差 -477600')
  })

  it('两处都对不上时两条都列出来，不只报第一条', () => {
    const result = checkAmountMatch({
      ...base,
      shipmentTotalMinor: 1n,
      statementTotalMinor: 2n,
    })

    expect(result.note).toContain('与出货金额相差')
    expect(result.note).toContain('与对账单相差')
  })

  it('没关联对账单时只比出货这一头', () => {
    expect(
      checkAmountMatch({ ...base, statementTotalMinor: null }),
    ).toEqual({ matched: true, note: null })
  })

  it('说明里带上币种，跨币种客户看得懂', () => {
    const result = checkAmountMatch({ ...base, shipmentTotalMinor: 0n, currency: 'USD' })
    expect(result.note).toContain('USD')
  })
})

describe('累计红冲不得超过原票', () => {
  it.each([
    [14_039_120n, 0n, 14_039_120n],
    [14_039_120n, 4_000_000n, 10_039_120n],
    [14_039_120n, 14_039_120n, 0n],
    // 已经冲超了也只回 0，不返回负数让调用方再判一次符号
    [14_039_120n, 20_000_000n, 0n],
  ])('原票 %s 已冲 %s → 还能冲 %s', (original, credited, expected) => {
    expect(remainingCreditable(original, credited)).toBe(expected)
  })
})
