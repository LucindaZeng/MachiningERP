import Decimal from 'decimal.js'

/**
 * 定点数解析的唯一入口。
 * decimal.js 对非法输入抛的是自带的 DecimalError，这里统一归一化成 RangeError，
 * 免得调用方为了区分错误类型去 catch 三方库的私有错误。
 */
export function parseDecimal(value: string | number, label = '数值'): Decimal {
  let decimal: Decimal
  try {
    decimal = new Decimal(value)
  } catch {
    throw new RangeError(`${label}不是合法的定点数：${String(value)}`)
  }

  if (!decimal.isFinite()) {
    throw new RangeError(`${label}不是有限数：${String(value)}`)
  }

  return decimal
}
