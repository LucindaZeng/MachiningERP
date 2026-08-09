import Decimal from 'decimal.js'

import { parseDecimal } from '../decimal/parse-decimal'

import { exponentOf } from './currency'
import { toMinor } from './money-codec'
import { DEFAULT_ROUNDING, toDecimalRounding, type RoundingMode } from './rounding'

import type { MoneyMinor } from './money'

function assertSameCurrency(left: MoneyMinor, right: MoneyMinor): void {
  if (left.currency !== right.currency) {
    throw new TypeError(`币种不一致，禁止直接运算：${left.currency} vs ${right.currency}`)
  }
}

export function addMinor(left: MoneyMinor, right: MoneyMinor): MoneyMinor {
  assertSameCurrency(left, right)
  return { minor: left.minor + right.minor, currency: left.currency }
}

export function subtractMinor(left: MoneyMinor, right: MoneyMinor): MoneyMinor {
  assertSameCurrency(left, right)
  return { minor: left.minor - right.minor, currency: left.currency }
}

export function sumMinor(values: readonly MoneyMinor[]): MoneyMinor | null {
  const [head, ...rest] = values
  if (!head) return null
  return rest.reduce(addMinor, head)
}

export function compareMinor(left: MoneyMinor, right: MoneyMinor): -1 | 0 | 1 {
  assertSameCurrency(left, right)
  if (left.minor < right.minor) return -1
  return left.minor > right.minor ? 1 : 0
}

export function isNegativeMinor(value: MoneyMinor): boolean {
  return value.minor < 0n
}

/**
 * 金额 × 倍率（数量、损耗率、税率、汇率、香港 70% 折算等）。
 * 倍率用 decimal 字符串表达，结果按币种精度舍入回整数分。
 */
export function multiplyMinor(
  value: MoneyMinor,
  factor: string,
  mode: RoundingMode = DEFAULT_ROUNDING,
): MoneyMinor {
  const product = new Decimal(value.minor.toString()).mul(parseDecimal(factor, '倍率'))
  const rounded = product.toDecimalPlaces(0, toDecimalRounding(mode))
  return { minor: BigInt(rounded.toFixed(0)), currency: value.currency }
}

/** 汇率换算：按目标币种精度重新取整，保留换算前后的可审计性由调用方负责落快照。 */
export function convertMinor(
  value: MoneyMinor,
  rate: string,
  target: MoneyMinor['currency'],
  mode: RoundingMode = DEFAULT_ROUNDING,
): MoneyMinor {
  const sourceUnits = new Decimal(value.minor.toString()).div(
    Decimal.pow(10, exponentOf(value.currency)),
  )
  const converted = sourceUnits.mul(parseDecimal(rate, '汇率'))
  return toMinor(converted.toFixed(12), target, mode)
}

/**
 * 按权重把金额拆分到多行且保证合计不丢分（最大余数法）。
 * 用于模具费之外的公共费用分摊、发票行拆分等场景。
 */
export function allocateMinor(value: MoneyMinor, weights: readonly string[]): MoneyMinor[] {
  const total = weights.reduce((acc, weight) => acc.add(parseDecimal(weight, '权重')), new Decimal(0))
  if (total.isZero()) {
    throw new RangeError('分摊权重合计为 0，无法分摊')
  }

  const shares = weights.map((weight) =>
    new Decimal(value.minor.toString()).mul(parseDecimal(weight, '权重')).div(total).toDecimalPlaces(0, Decimal.ROUND_FLOOR),
  )
  const allocated = shares.reduce((acc, share) => acc.add(share), new Decimal(0))
  let remainder = BigInt(new Decimal(value.minor.toString()).sub(allocated).toFixed(0))

  return shares.map((share) => {
    let minor = BigInt(share.toFixed(0))
    if (remainder > 0n) {
      minor += 1n
      remainder -= 1n
    }
    return { minor, currency: value.currency }
  })
}
