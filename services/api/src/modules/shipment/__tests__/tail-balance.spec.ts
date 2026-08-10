import {
  collectTailImbalances,
  hasOutstandingTail,
  outstandingTailOf,
  tailQtyOf,
  totalTailQty,
} from '../services/tail-balance.rules'

import type { TailLineFacts } from '../services/tail-balance.rules'

function line(overrides: Partial<TailLineFacts> = {}): TailLineFacts {
  return {
    sequence: 1,
    productName: '探头支架',
    orderedQty: '1500.000000',
    shippedQty: '1486.000000',
    tailResolvedQty: '0.000000',
    tailPlan: null,
    ...overrides,
  }
}

describe('尾数 = 订单数 − 已发数', () => {
  it('少发时尾数为差额', () => {
    expect(tailQtyOf(line())).toBe('14.000000')
  })

  it('发齐时尾数为 0', () => {
    expect(tailQtyOf(line({ shippedQty: '1500.000000' }))).toBe('0.000000')
  })

  it('超发按 0 处理——超发由建单校验拦，不在这里兜出一个负尾数', () => {
    expect(tailQtyOf(line({ shippedQty: '1600.000000' }))).toBe('0.000000')
  })

  it('小数数量照样算得准', () => {
    expect(tailQtyOf(line({ orderedQty: '10.500000', shippedQty: '10.250000' }))).toBe('0.250000')
  })
})

describe('未结尾数 = 尾数 − 已处置', () => {
  it('一点没处置时全额未结', () => {
    expect(outstandingTailOf(line())).toBe('14.000000')
    expect(hasOutstandingTail(line())).toBe(true)
  })

  it('处置一部分后只剩差额', () => {
    expect(outstandingTailOf(line({ tailResolvedQty: '10.000000' }))).toBe('4.000000')
  })

  it('全部处置后归零', () => {
    const resolved = line({ tailResolvedQty: '14.000000', tailPlan: 'REWORK' })
    expect(outstandingTailOf(resolved)).toBe('0.000000')
    expect(hasOutstandingTail(resolved)).toBe(false)
  })

  it('处置数量多于尾数也按 0，不倒挂', () => {
    expect(outstandingTailOf(line({ tailResolvedQty: '20.000000' }))).toBe('0.000000')
  })

  it('本来就没有尾数的行不算未结', () => {
    expect(hasOutstandingTail(line({ shippedQty: '1500.000000' }))).toBe(false)
  })
})

describe('结案数量平衡校验', () => {
  it('所有行都平了才允许结案', () => {
    const lines = [
      line({ sequence: 1, shippedQty: '1500.000000' }),
      line({ sequence: 2, tailResolvedQty: '14.000000', tailPlan: 'SCRAP' }),
    ]
    expect(collectTailImbalances(lines)).toEqual([])
  })

  it('未结的行被逐条列出，带上还欠多少', () => {
    const lines = [
      line({ sequence: 1, shippedQty: '1500.000000' }),
      line({ sequence: 2, productName: '定位销座', tailResolvedQty: '4.000000' }),
      line({ sequence: 3, productName: '导轨压板' }),
    ]
    const imbalances = collectTailImbalances(lines)

    expect(imbalances).toEqual([
      { sequence: 2, productName: '定位销座', outstandingQty: '10.000000' },
      { sequence: 3, productName: '导轨压板', outstandingQty: '14.000000' },
    ])
  })

  it('空明细视为平衡（空单不该走到结案，由别处拦）', () => {
    expect(collectTailImbalances([])).toEqual([])
  })
})

describe('整单尾数合计', () => {
  it('逐行相加', () => {
    expect(
      totalTailQty([line({ sequence: 1 }), line({ sequence: 2, shippedQty: '1500.000000' })]),
    ).toBe('14.000000')
  })

  it('没有明细时是 0', () => {
    expect(totalTailQty([])).toBe('0.000000')
  })
})
