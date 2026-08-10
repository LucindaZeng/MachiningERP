import {
  NEEDS_FINANCE_APPROVAL,
  REQUIRES_REASON,
  STATEMENT_EFFECT,
  isDispositionWire,
  isResponsibilityWire,
  requiresGoodsReceipt,
  statementLineTypeOf,
} from '../constants/return-dispositions'
import {
  deductionMinorOf,
  deductionTypeOf,
  totalDeductionOf,
  type ReturnDeductionFacts,
} from '../services/return-statement.rules'

import type { ReturnDisposition } from '@prisma/client'

const ALL: ReturnDisposition[] = [
  'REFUND',
  'REPLACEMENT',
  'REWORK',
  'CONCESSION',
  'SCRAP',
  'UNDECIDED',
]

function facts(overrides: Partial<ReturnDeductionFacts> = {}): ReturnDeductionFacts {
  return { disposition: 'REFUND', amountMinor: 477_600n, allowanceMinor: null, ...overrides }
}

/**
 * 这张表就是与用户敲定的口径本身。改动它等于改动客户对账单上的数字，
 * 所以逐格断言——让任何一次「顺手调整」都必须先来改这份测试。
 */
describe('处置 → 对账单口径判定表', () => {
  it.each([
    ['REFUND', 'RETURN'],
    ['SCRAP', 'RETURN'],
    ['CONCESSION', 'ALLOWANCE'],
    ['REWORK', null],
    ['REPLACEMENT', null],
    ['UNDECIDED', null],
  ] as const)('%s → %s', (disposition, expected) => {
    expect(deductionTypeOf(disposition)).toBe(expected)
    expect(statementLineTypeOf(disposition)).toBe(expected)
  })

  it('六种处置一个不漏地被判定表覆盖', () => {
    for (const disposition of ALL) {
      expect(STATEMENT_EFFECT).toHaveProperty(disposition)
      expect(NEEDS_FINANCE_APPROVAL).toHaveProperty(disposition)
      expect(REQUIRES_REASON).toHaveProperty(disposition)
    }
  })

  it('让步是 ALLOWANCE 不是 RETURN——货还在客户手里，不能写成退货', () => {
    expect(deductionTypeOf('CONCESSION')).toBe('ALLOWANCE')
    expect(deductionTypeOf('CONCESSION')).not.toBe('RETURN')
  })
})

describe('扣减金额取法', () => {
  it('退款扣整行货值', () => {
    expect(deductionMinorOf(facts({ disposition: 'REFUND' }))).toBe(477_600n)
  })

  it('报废也扣整行货值——不给客户抵掉这笔，客诉就没解决', () => {
    expect(deductionMinorOf(facts({ disposition: 'SCRAP' }))).toBe(477_600n)
  })

  it('让步只扣谈定的减价额，不是整行货值', () => {
    const value = deductionMinorOf(
      facts({ disposition: 'CONCESSION', amountMinor: 477_600n, allowanceMinor: 60_000n }),
    )
    expect(value).toBe(60_000n)
  })

  it.each(['REWORK', 'REPLACEMENT', 'UNDECIDED'] as const)('%s 一分不扣', (disposition) => {
    expect(deductionMinorOf(facts({ disposition }))).toBe(0n)
  })

  it('让步而没录折让额时返回 0，不抛错——结案闸门早就把这种行拦下了', () => {
    expect(deductionMinorOf(facts({ disposition: 'CONCESSION', allowanceMinor: null }))).toBe(0n)
  })

  it('源数据带了负号也一律取正：符号由对账汇总按类型统一加', () => {
    expect(deductionMinorOf(facts({ disposition: 'REFUND', amountMinor: -477_600n }))).toBe(477_600n)
    expect(
      deductionMinorOf(facts({ disposition: 'CONCESSION', allowanceMinor: -60_000n })),
    ).toBe(60_000n)
  })
})

describe('整单分类合计', () => {
  const lines: ReturnDeductionFacts[] = [
    facts({ disposition: 'REFUND', amountMinor: 100n }),
    facts({ disposition: 'SCRAP', amountMinor: 30n }),
    facts({ disposition: 'CONCESSION', amountMinor: 500n, allowanceMinor: 50n }),
    facts({ disposition: 'REWORK', amountMinor: 999n }),
  ]

  it('RETURN 合计 = 退款 + 报废', () => {
    expect(totalDeductionOf(lines, 'RETURN')).toBe(130n)
  })

  it('ALLOWANCE 合计只取折让额，不是让步行的货值', () => {
    expect(totalDeductionOf(lines, 'ALLOWANCE')).toBe(50n)
  })

  it('返工完全不参与——它那 999 一分都不该出现在对账单上', () => {
    expect(totalDeductionOf(lines, 'RETURN') + totalDeductionOf(lines, 'ALLOWANCE')).toBe(180n)
  })
})

describe('线上值字典', () => {
  it('前端来的合法值认得出来', () => {
    expect(isDispositionWire('concession')).toBe(true)
    expect(isResponsibilityWire('supplier')).toBe(true)
  })

  it('不认识的值不放行', () => {
    expect(isDispositionWire('eight-d')).toBe(false)
    expect(isResponsibilityWire('unknown')).toBe(false)
  })

  it('只有返工要求先收到不良品', () => {
    expect(requiresGoodsReceipt('REWORK')).toBe(true)
    for (const disposition of ALL.filter((item) => item !== 'REWORK')) {
      expect(requiresGoodsReceipt(disposition)).toBe(false)
    }
  })
})
