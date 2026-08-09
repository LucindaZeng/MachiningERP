import {
  describeBelowCost,
  findBelowCostTiers,
  validateQuotationDraft,
  type QuotationDraftInput,
  type QuotationItemInput,
} from '../services/quotation-rules'

const yuan = (value: number): bigint => BigInt(Math.round(value * 100))

function item(overrides: Partial<QuotationItemInput> = {}): QuotationItemInput {
  return {
    productName: '金属壳体1',
    drawingNo: 'BCM-2607',
    drawingVersionId: 'DV1',
    costAnalysisLineId: 'CAL1',
    tiers: [{ minQuantity: '100', unitPriceMinor: yuan(25), unitCostMinor: yuan(20) }],
    ...overrides,
  }
}

const VALID: QuotationDraftInput = {
  customerId: 'CU1',
  costAnalysisId: 'CA1',
  items: [item()],
}

function fieldsOf(input: QuotationDraftInput): string[] {
  return validateQuotationDraft(input).map((issue) => issue.field)
}

describe('硬校验：每份报价单必须关联成本分析', () => {
  it('齐全时通过', () => {
    expect(validateQuotationDraft(VALID)).toEqual([])
  })

  it('没有成本分析直接拦下，并提示先找报价工程师核价', () => {
    const issues = validateQuotationDraft({ ...VALID, costAnalysisId: null })

    expect(issues.map((issue) => issue.field)).toContain('costAnalysisId')
    expect(issues[0]?.message).toContain('报价工程师')
  })
})

describe('硬校验：报价单强制上传图纸', () => {
  it('缺图纸的产品行被拦下，提示里带产品名', () => {
    const issues = validateQuotationDraft({
      ...VALID,
      items: [item({ drawingVersionId: null })],
    })

    expect(issues.map((issue) => issue.field)).toContain('items[0].drawingVersionId')
    expect(issues[0]?.message).toContain('金属壳体1')
    expect(issues[0]?.message).toContain('必须上传图纸')
  })

  it('多行里只有一行缺图纸时，只报那一行', () => {
    const issues = validateQuotationDraft({
      ...VALID,
      items: [item(), item({ productName: '金属壳体2', drawingVersionId: null })],
    })

    expect(issues.map((issue) => issue.field)).toEqual(['items[1].drawingVersionId'])
  })
})

describe('阶梯价校验', () => {
  it('至少要有一档', () => {
    expect(fieldsOf({ ...VALID, items: [item({ tiers: [] })] })).toContain('items[0].tiers')
  })

  it('非阶梯报价（单一数量）合法', () => {
    const single = item({
      tiers: [{ minQuantity: '500', unitPriceMinor: yuan(9), unitCostMinor: yuan(8) }],
    })
    expect(validateQuotationDraft({ ...VALID, items: [single] })).toEqual([])
  })

  it('阶梯数量段必须递增且不重复', () => {
    const descending = item({
      tiers: [
        { minQuantity: '100', unitPriceMinor: yuan(25), unitCostMinor: yuan(20) },
        { minQuantity: '50', unitPriceMinor: yuan(28), unitCostMinor: yuan(20) },
      ],
    })
    expect(fieldsOf({ ...VALID, items: [descending] })).toContain('items[0].tiers[1].minQuantity')

    const duplicated = item({
      tiers: [
        { minQuantity: '100', unitPriceMinor: yuan(25), unitCostMinor: yuan(20) },
        { minQuantity: '100', unitPriceMinor: yuan(24), unitCostMinor: yuan(20) },
      ],
    })
    expect(fieldsOf({ ...VALID, items: [duplicated] })).toContain('items[0].tiers[1].minQuantity')
  })

  it('样例模板的 10/30/50 + 100/200/500/1000 阶梯合法', () => {
    const ladder = item({
      tiers: ['10', '30', '50', '100', '200', '500', '1000'].map((minQuantity, index) => ({
        minQuantity,
        unitPriceMinor: yuan(20 - index),
        unitCostMinor: yuan(5),
      })),
    })
    expect(validateQuotationDraft({ ...VALID, items: [ladder] })).toEqual([])
  })

  it('起订量必须大于 0，报价不能为负', () => {
    const bad = item({
      tiers: [{ minQuantity: '0', unitPriceMinor: yuan(-1), unitCostMinor: yuan(5) }],
    })
    const fields = fieldsOf({ ...VALID, items: [bad] })

    expect(fields).toContain('items[0].tiers[0].minQuantity')
    expect(fields).toContain('items[0].tiers[0].unitPrice')
  })

  it('产品名必填', () => {
    expect(fieldsOf({ ...VALID, items: [item({ productName: '  ' })] })).toContain(
      'items[0].productName',
    )
  })

  it('一行产品都没有时拦下', () => {
    expect(fieldsOf({ ...VALID, items: [] })).toContain('items')
  })
})

describe('低于成本价拦截', () => {
  it('高于成本不报', () => {
    expect(findBelowCostTiers([item()])).toEqual([])
  })

  it('等于成本不报（打平允许）', () => {
    const breakEven = item({
      tiers: [{ minQuantity: '100', unitPriceMinor: yuan(20), unitCostMinor: yuan(20) }],
    })
    expect(findBelowCostTiers([breakEven])).toEqual([])
  })

  it('低于成本时把缺口逐档列清楚', () => {
    const below = item({
      tiers: [
        { minQuantity: '100', unitPriceMinor: yuan(18), unitCostMinor: yuan(20) },
        { minQuantity: '500', unitPriceMinor: yuan(25), unitCostMinor: yuan(20) },
      ],
    })
    const violations = findBelowCostTiers([below])

    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({
      itemIndex: 0,
      tierIndex: 0,
      productName: '金属壳体1',
      shortfallMinor: yuan(2),
    })
  })

  it('多行多档时逐一列出', () => {
    const violations = findBelowCostTiers([
      item({ tiers: [{ minQuantity: '100', unitPriceMinor: yuan(1), unitCostMinor: yuan(20) }] }),
      item({
        productName: '金属壳体2',
        tiers: [{ minQuantity: '100', unitPriceMinor: yuan(2), unitCostMinor: yuan(20) }],
      }),
    ])

    expect(violations.map((violation) => violation.productName)).toEqual(['金属壳体1', '金属壳体2'])
  })

  it('提示文案给出报价、成本与缺口，便于业务发起修改申请', () => {
    const below = item({
      tiers: [{ minQuantity: '100', unitPriceMinor: yuan(18.5), unitCostMinor: yuan(20) }],
    })
    const text = describeBelowCost(findBelowCostTiers([below]))

    expect(text).toContain('金属壳体1')
    expect(text).toContain('18.50')
    expect(text).toContain('20.00')
    expect(text).toContain('缺口 1.50')
  })

  it('没有违规时文案为空串', () => {
    expect(describeBelowCost([])).toBe('')
  })
})
