import type { CurrencyCode } from './currency'

/**
 * 传输层金额（api-conventions.md「金额 `{ amount, currency }` 字符串定点数」）。
 * amount 为定点小数字符串，禁止用 number 传输，避免二进制浮点误差。
 */
export interface Money {
  amount: string
  currency: CurrencyCode
}

/**
 * 存储与计算层金额（development-guide 第 4 节「金额用整数分 + 币种字段」）。
 * minor 为最小货币单位的整数值（人民币即「分」），用 bigint 保证不丢精度。
 */
export interface MoneyMinor {
  minor: bigint
  currency: CurrencyCode
}
