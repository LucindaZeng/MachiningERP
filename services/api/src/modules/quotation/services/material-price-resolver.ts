import { parseDecimal } from '@machining-erp/shared'

export interface MaterialPriceCandidate {
  id: string
  material: string
  shape: string
  unitPriceMinor: bigint
  currency: string
  effectiveFrom: Date
}

export interface ResolvedMaterialPrice {
  sourceId: string
  unitPriceMinor: bigint
  currency: string
  effectiveFrom: Date
}

/**
 * 取材料单价：**不晚于报价日期的最新一条**。
 *
 * 这条「按日期取价」的规则是历史可追溯的前提——成本分析要能在半年后重算出
 * 当时的数字，就不能拿今天的价格表去套（业务规格 2.1：历史数据不随价格表更新而变化）。
 */
export function resolveMaterialPrice(
  candidates: readonly MaterialPriceCandidate[],
  material: string,
  shape: string,
  quotedOn: Date,
): ResolvedMaterialPrice | null {
  const matched = candidates
    .filter(
      (candidate) =>
        candidate.material === material &&
        candidate.shape === shape &&
        candidate.effectiveFrom.getTime() <= quotedOn.getTime(),
    )
    .sort((left, right) => right.effectiveFrom.getTime() - left.effectiveFrom.getTime())

  const best = matched[0]
  if (!best) return null

  return {
    sourceId: best.id,
    unitPriceMinor: best.unitPriceMinor,
    currency: best.currency,
    effectiveFrom: best.effectiveFrom,
  }
}

export const FX_SCALE = 1_000_000

export interface ExchangeRateSnapshot {
  base: string
  quote: string
  rateMicros: bigint
  quotedOn: Date
}

/**
 * 按当日汇率把人民币成本折算成外币报价参考（业务规格 2.4）。
 * 汇率按百万分比存整数，换算结果保留到分。
 */
export function convertByRate(amountMinor: bigint, rate: ExchangeRateSnapshot): bigint {
  const converted = parseDecimal(amountMinor.toString(), '金额')
    .mul(parseDecimal(rate.rateMicros.toString(), '汇率'))
    .div(FX_SCALE)

  return BigInt(converted.toFixed(0))
}

/** 取当日汇率：同样是「不晚于报价日期的最新一条」。 */
export function resolveExchangeRate(
  candidates: readonly ExchangeRateSnapshot[],
  base: string,
  quote: string,
  quotedOn: Date,
): ExchangeRateSnapshot | null {
  const matched = candidates
    .filter(
      (candidate) =>
        candidate.base === base &&
        candidate.quote === quote &&
        candidate.quotedOn.getTime() <= quotedOn.getTime(),
    )
    .sort((left, right) => right.quotedOn.getTime() - left.quotedOn.getTime())

  return matched[0] ?? null
}
