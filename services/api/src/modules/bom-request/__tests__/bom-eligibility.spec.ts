import { assertEligibleForBom, isEffectiveQuotation } from '../services/bom-eligibility.rules'

import type { QuotationLineFacts } from '../services/bom-eligibility.rules'

function facts(overrides: Partial<QuotationLineFacts> = {}): QuotationLineFacts {
  return {
    quotationStatus: 'EFFECTIVE',
    isSampleLine: false,
    quotationItemId: 'QI1',
    drawingVersionId: 'DV1',
    ...overrides,
  }
}

describe('样品永远不建 BOM', () => {
  it('样品行直接被拒，错误码 ORD_2401', () => {
    expect(() => assertEligibleForBom(facts({ isSampleLine: true }))).toThrow(
      /样品订单不建 BOM/,
    )
  })

  it('样品判断优先于报价状态——先说清「样品不该走这条路」', () => {
    // 报价还没生效 + 又是样品行：应该报样品那条，而不是「报价未生效」
    try {
      assertEligibleForBom(facts({ isSampleLine: true, quotationStatus: 'DRAFT' }))
    } catch (error) {
      expect(error).toMatchObject({ code: 'ORD_2401' })
    }
    expect.assertions(1)
  })

  it('样品行即便图纸齐备也不给建', () => {
    expect(() =>
      assertEligibleForBom(facts({ isSampleLine: true, drawingVersionId: 'DV9' })),
    ).toThrow(/样品/)
  })
})

describe('必须是生效报价', () => {
  it('生效报价放行', () => {
    expect(() => assertEligibleForBom(facts())).not.toThrow()
  })

  it('已成交（WON）同样放行——已经下单的产品当然要建 BOM', () => {
    expect(() => assertEligibleForBom(facts({ quotationStatus: 'WON' }))).not.toThrow()
  })

  it('草稿报价被拒，并把当前状态写进提示', () => {
    expect(() => assertEligibleForBom(facts({ quotationStatus: 'DRAFT' }))).toThrow(
      /当前状态为「DRAFT」/,
    )
  })

  it('审核中的报价被拒——随时可能改，据此建 BOM 等于白建', () => {
    expect(() => assertEligibleForBom(facts({ quotationStatus: 'IN_REVIEW' }))).toThrow(
      /只有生效报价/,
    )
  })

  it('已失效与丢单的报价被拒', () => {
    for (const status of ['EXPIRED', 'LOST']) {
      expect(() => assertEligibleForBom(facts({ quotationStatus: status }))).toThrow()
    }
  })

  it('错误码是 ORD_2402，details 里带状态供前端提示', () => {
    try {
      assertEligibleForBom(facts({ quotationStatus: 'DRAFT' }))
    } catch (error) {
      expect(error).toMatchObject({
        code: 'ORD_2402',
        details: { quotationStatus: 'DRAFT' },
      })
    }
    expect.assertions(1)
  })

  it('isEffectiveQuotation 与校验同一口径', () => {
    expect(isEffectiveQuotation('EFFECTIVE')).toBe(true)
    expect(isEffectiveQuotation('WON')).toBe(true)
    expect(isEffectiveQuotation('DRAFT')).toBe(false)
    expect(isEffectiveQuotation('IN_REVIEW')).toBe(false)
  })
})

describe('图纸沿用报价环节的版本', () => {
  it('没引用报价行就拒', () => {
    expect(() => assertEligibleForBom(facts({ quotationItemId: null }))).toThrow(/引用报价单/)
  })

  it('没有图纸版本就拒——那意味着有人打算另传一份', () => {
    expect(() => assertEligibleForBom(facts({ drawingVersionId: null }))).toThrow(
      /没有图纸版本/,
    )
  })

  it('报价行缺失优先于图纸缺失报出来', () => {
    try {
      assertEligibleForBom(facts({ quotationItemId: null, drawingVersionId: null }))
    } catch (error) {
      expect(error).toMatchObject({ code: 'ORD_2402' })
    }
    expect.assertions(1)
  })
})
