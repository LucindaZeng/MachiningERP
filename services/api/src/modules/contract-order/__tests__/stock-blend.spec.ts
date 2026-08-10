import { blendStockCost, isStockExhausted, remainingAfter } from '../services/stock-blend'

describe('备料加权平均成本（业务规格 4.5 的原例）', () => {
  it('订单100 / 备料20@10元 / 新产80@12元 → 11.6 元/件', () => {
    const result = blendStockCost({
      orderQty: '100',
      availableQty: '20',
      stockUnitCostMinor: 1_000n,
      produceUnitCostMinor: 1_200n,
    })

    expect(result.consumedQty).toBe('20')
    expect(result.produceQty).toBe('80')
    // (10×20 + 12×80) ÷ 100 = 11.6 元 = 1160 分
    expect(result.blendedUnitCostMinor).toBe(1_160n)
  })
})

describe('优先消耗备料，直到用完', () => {
  it('备料够用时全部领用，无需新产，加权成本就等于备料成本', () => {
    const result = blendStockCost({
      orderQty: '50',
      availableQty: '200',
      stockUnitCostMinor: 1_000n,
      produceUnitCostMinor: 1_200n,
    })

    expect(result.consumedQty).toBe('50')
    expect(result.produceQty).toBe('0')
    expect(result.blendedUnitCostMinor).toBe(1_000n)
  })

  it('没有备料可领时全部新产，加权成本等于新产成本', () => {
    const result = blendStockCost({
      orderQty: '100',
      availableQty: '0',
      stockUnitCostMinor: 1_000n,
      produceUnitCostMinor: 1_200n,
    })

    expect(result.consumedQty).toBe('0')
    expect(result.produceQty).toBe('100')
    expect(result.blendedUnitCostMinor).toBe(1_200n)
  })

  it('备料余量为负（脏数据）按 0 处理，不会算出负的领用量', () => {
    const result = blendStockCost({
      orderQty: '100',
      availableQty: '-5',
      stockUnitCostMinor: 1_000n,
      produceUnitCostMinor: 1_200n,
    })

    expect(result.consumedQty).toBe('0')
    expect(result.produceQty).toBe('100')
  })

  it('恰好用完时新产为 0', () => {
    const result = blendStockCost({
      orderQty: '30',
      availableQty: '30',
      stockUnitCostMinor: 800n,
      produceUnitCostMinor: 900n,
    })

    expect(result.produceQty).toBe('0')
    expect(result.blendedUnitCostMinor).toBe(800n)
  })
})

describe('精度', () => {
  it('除不尽时四舍五入到分，而不是截断', () => {
    // (1000×1 + 1200×2) ÷ 3 = 3400/3 = 1133.333… → 1133
    const result = blendStockCost({
      orderQty: '3',
      availableQty: '1',
      stockUnitCostMinor: 1_000n,
      produceUnitCostMinor: 1_200n,
    })

    expect(result.blendedUnitCostMinor).toBe(1_133n)
    expect(result.exactBlendedUnitCost).toMatch(/^1133\.33/)
  })

  it('保留全精度值供后续继续参与计算', () => {
    const result = blendStockCost({
      orderQty: '7',
      availableQty: '2',
      stockUnitCostMinor: 1_000n,
      produceUnitCostMinor: 1_500n,
    })

    // (1000×2 + 1500×5) ÷ 7 = 9500/7 = 1357.142857…
    expect(result.exactBlendedUnitCost.startsWith('1357.14')).toBe(true)
    expect(result.blendedUnitCostMinor).toBe(1_357n)
  })

  it('小数数量也能算', () => {
    const result = blendStockCost({
      orderQty: '10.5',
      availableQty: '0.5',
      stockUnitCostMinor: 1_000n,
      produceUnitCostMinor: 2_000n,
    })

    // (1000×0.5 + 2000×10) ÷ 10.5 = 20500/10.5 = 1952.38…
    expect(result.blendedUnitCostMinor).toBe(1_952n)
  })

  it('订单数量为 0 时给 0，而不是让除法炸掉', () => {
    const result = blendStockCost({
      orderQty: '0',
      availableQty: '10',
      stockUnitCostMinor: 1_000n,
      produceUnitCostMinor: 1_200n,
    })

    expect(result.blendedUnitCostMinor).toBe(0n)
    expect(result.consumedQty).toBe('0')
  })

  it('非法数量字符串按 RangeError 抛出，不静默当 0', () => {
    expect(() =>
      blendStockCost({
        orderQty: 'abc',
        availableQty: '10',
        stockUnitCostMinor: 1_000n,
        produceUnitCostMinor: 1_200n,
      }),
    ).toThrow(RangeError)
  })
})

describe('备料余量', () => {
  it('领用后余量递减', () => {
    expect(remainingAfter('20', '5')).toBe('15')
  })

  it('超领时余量归零而不是变负', () => {
    expect(remainingAfter('20', '25')).toBe('0')
  })

  it('余量为 0 即视为已用完', () => {
    expect(isStockExhausted('0')).toBe(true)
    expect(isStockExhausted('0.000001')).toBe(false)
  })

  it('残留负值同样视为已用完', () => {
    expect(isStockExhausted('-0.0001')).toBe(true)
  })
})
