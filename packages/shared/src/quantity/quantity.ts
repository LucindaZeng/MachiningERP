import Decimal from 'decimal.js'

import { parseDecimal } from '../decimal/parse-decimal'

/**
 * 数量一律用定点小数字符串表达（development-guide 第 4 节「数量用 decimal 字符串，禁止浮点」）。
 * 默认保留 6 位小数，足以覆盖 KG / MM / PCS / SET 各计量单位。
 */
export type Quantity = string

export const QUANTITY_SCALE = 6

export function quantityOf(value: string | number): Quantity {
  return parseDecimal(value, '数量').toFixed(QUANTITY_SCALE)
}

export function addQuantity(left: Quantity, right: Quantity): Quantity {
  return parseDecimal(left, '数量').add(parseDecimal(right, '数量')).toFixed(QUANTITY_SCALE)
}

export function subtractQuantity(left: Quantity, right: Quantity): Quantity {
  return parseDecimal(left, '数量').sub(parseDecimal(right, '数量')).toFixed(QUANTITY_SCALE)
}

export function multiplyQuantity(left: Quantity, factor: string): Quantity {
  return parseDecimal(left, '数量').mul(parseDecimal(factor, '倍率')).toFixed(QUANTITY_SCALE)
}

export function compareQuantity(left: Quantity, right: Quantity): -1 | 0 | 1 {
  const comparison = parseDecimal(left, '数量').comparedTo(parseDecimal(right, '数量'))
  if (comparison < 0) return -1
  return comparison > 0 ? 1 : 0
}

export function isPositiveQuantity(value: Quantity): boolean {
  return new Decimal(value).greaterThan(0)
}

export function isZeroQuantity(value: Quantity): boolean {
  return new Decimal(value).isZero()
}

/** 展示用：去掉尾部无意义的 0，例如 "100.000000" → "100"。 */
export function formatQuantity(value: Quantity): string {
  return new Decimal(value).toFixed()
}
