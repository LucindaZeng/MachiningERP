import Decimal from 'decimal.js'

import { parseDecimal } from '../decimal/parse-decimal'

import { exponentOf, type CurrencyCode } from './currency'
import { DEFAULT_ROUNDING, toDecimalRounding, type RoundingMode } from './rounding'

import type { Money, MoneyMinor } from './money'

/** 传输层定点字符串 → 存储层整数分。非法输入直接抛错，禁止静默取 0。 */
export function toMinor(
  amount: string,
  currency: CurrencyCode,
  mode: RoundingMode = DEFAULT_ROUNDING,
): MoneyMinor {
  const decimal = parseDecimal(amount, '金额')
  const scaled = decimal.mul(Decimal.pow(10, exponentOf(currency)))
  const rounded = scaled.toDecimalPlaces(0, toDecimalRounding(mode))
  return { minor: BigInt(rounded.toFixed(0)), currency }
}

/** 存储层整数分 → 传输层定点字符串（始终补齐到币种精度位数）。 */
export function fromMinor(value: MoneyMinor): Money {
  const exponent = exponentOf(value.currency)
  const amount = new Decimal(value.minor.toString())
    .div(Decimal.pow(10, exponent))
    .toFixed(exponent)
  return { amount, currency: value.currency }
}

export function zeroMinor(currency: CurrencyCode): MoneyMinor {
  return { minor: 0n, currency }
}

export function moneyOf(amount: string, currency: CurrencyCode): Money {
  return fromMinor(toMinor(amount, currency))
}
