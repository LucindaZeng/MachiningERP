import {
  FX_SCALE,
  convertByRate,
  resolveExchangeRate,
  resolveMaterialPrice,
  type ExchangeRateSnapshot,
  type MaterialPriceCandidate,
} from '../services/material-price-resolver'

const yuan = (value: number): bigint => BigInt(Math.round(value * 100))
const at = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

const PRICES: MaterialPriceCandidate[] = [
  { id: 'P1', material: 'AL6061-T6', shape: '板料', unitPriceMinor: yuan(27), currency: 'CNY', effectiveFrom: at('2026-01-01') },
  { id: 'P2', material: 'AL6061-T6', shape: '板料', unitPriceMinor: yuan(29), currency: 'CNY', effectiveFrom: at('2026-04-01') },
  { id: 'P3', material: 'AL6061-T6', shape: '板料', unitPriceMinor: yuan(31), currency: 'CNY', effectiveFrom: at('2026-09-01') },
  { id: 'P4', material: 'AL6061-T6', shape: '型材', unitPriceMinor: yuan(33), currency: 'CNY', effectiveFrom: at('2026-04-01') },
  { id: 'P5', material: 'SUS304', shape: '板料', unitPriceMinor: yuan(52), currency: 'CNY', effectiveFrom: at('2026-04-01') },
]

describe('材料单价取「不晚于报价日期的最新一条」', () => {
  it('取到报价当日生效的价格，而不是最新价', () => {
    const resolved = resolveMaterialPrice(PRICES, 'AL6061-T6', '板料', at('2026-08-08'))

    // 2026-08-08 应取 4 月生效的 29，而不是 9 月才生效的 31
    expect(resolved).toMatchObject({ sourceId: 'P2', unitPriceMinor: yuan(29) })
  })

  it('生效当天即可取到', () => {
    expect(resolveMaterialPrice(PRICES, 'AL6061-T6', '板料', at('2026-04-01'))?.sourceId).toBe('P2')
  })

  it('生效前一天仍取上一条', () => {
    expect(resolveMaterialPrice(PRICES, 'AL6061-T6', '板料', at('2026-03-31'))?.sourceId).toBe('P1')
  })

  it('半年后重算历史成本分析仍能取回当时的价格', () => {
    expect(resolveMaterialPrice(PRICES, 'AL6061-T6', '板料', at('2026-02-15'))?.unitPriceMinor).toBe(
      yuan(27),
    )
  })

  it('材质与形态都要匹配', () => {
    expect(resolveMaterialPrice(PRICES, 'AL6061-T6', '型材', at('2026-08-08'))?.sourceId).toBe('P4')
    expect(resolveMaterialPrice(PRICES, 'SUS304', '板料', at('2026-08-08'))?.sourceId).toBe('P5')
  })

  it('查不到时返回 null，由调用方决定是拦下还是让报价工程师手填', () => {
    expect(resolveMaterialPrice(PRICES, 'TI-6AL-4V', '板料', at('2026-08-08'))).toBeNull()
    expect(resolveMaterialPrice(PRICES, 'AL6061-T6', '板料', at('2025-12-31'))).toBeNull()
    expect(resolveMaterialPrice([], 'AL6061-T6', '板料', at('2026-08-08'))).toBeNull()
  })
})

describe('当日汇率', () => {
  const RATES: ExchangeRateSnapshot[] = [
    { base: 'CNY', quote: 'USD', rateMicros: 138_900n, quotedOn: at('2026-08-01') },
    { base: 'CNY', quote: 'USD', rateMicros: 139_500n, quotedOn: at('2026-08-08') },
    { base: 'CNY', quote: 'EUR', rateMicros: 127_000n, quotedOn: at('2026-08-08') },
  ]

  it('同样取不晚于报价日期的最新一条', () => {
    expect(resolveExchangeRate(RATES, 'CNY', 'USD', at('2026-08-08'))?.rateMicros).toBe(139_500n)
    expect(resolveExchangeRate(RATES, 'CNY', 'USD', at('2026-08-05'))?.rateMicros).toBe(138_900n)
    expect(resolveExchangeRate(RATES, 'CNY', 'USD', at('2026-07-31'))).toBeNull()
  })

  it('币对要匹配', () => {
    expect(resolveExchangeRate(RATES, 'CNY', 'EUR', at('2026-08-08'))?.rateMicros).toBe(127_000n)
    expect(resolveExchangeRate(RATES, 'CNY', 'HKD', at('2026-08-08'))).toBeNull()
  })

  it('按汇率把人民币成本折算成外币，结果保留到分', () => {
    const rate = resolveExchangeRate(RATES, 'CNY', 'USD', at('2026-08-08'))!

    // 720.00 元 × 0.1395 = 100.44 USD
    expect(convertByRate(yuan(720), rate)).toBe(yuan(100.44))
  })

  it('汇率按百万分比存整数，不引入浮点误差', () => {
    const rate: ExchangeRateSnapshot = {
      base: 'CNY',
      quote: 'USD',
      rateMicros: 138_889n,
      quotedOn: at('2026-08-08'),
    }
    // 305.94 元 = 30594 分；30594 × 0.138889 = 4249.36… → 4249 分 = 42.49 USD
    expect(convertByRate(yuan(305.94), rate)).toBe(4249n)
    expect(FX_SCALE).toBe(1_000_000)
  })

  it('金额为 0 时换算仍是 0', () => {
    const rate = resolveExchangeRate(RATES, 'CNY', 'USD', at('2026-08-08'))!
    expect(convertByRate(0n, rate)).toBe(0n)
  })
})
