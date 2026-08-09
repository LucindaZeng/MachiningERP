/** 系统支持的币种及其最小货币单位指数（用于整数分存储）。 */
export const CURRENCY_EXPONENT = {
  CNY: 2,
  USD: 2,
  HKD: 2,
  EUR: 2,
  JPY: 0,
} as const

export type CurrencyCode = keyof typeof CURRENCY_EXPONENT

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCY_EXPONENT, value)
}

export function exponentOf(currency: CurrencyCode): number {
  return CURRENCY_EXPONENT[currency]
}
