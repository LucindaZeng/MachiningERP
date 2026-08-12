import { Decimal } from 'decimal.js'

/**
 * 金额与数量到 Excel 单元格的转换——**这是整数分口径唯一被放开的地方**。
 *
 * 系统内金额一律整数分、数量一律 decimal 字符串（development-guide 第 4 节）。
 * 但写进 Excel 必须是**真数字**：模板单元格自带 `#,##0.00` 这类格式，
 * 写成字符串格式就失效了，而且客户没法对那一列求和——
 * 一张不能求和的报价单，业务上等于没出。
 *
 * 因此转换只发生在这里，且只发生在渲染的最后一步，
 * 与 DTO 边界上「整数分 → 字符串」的规则并行存在、互不越界。
 */

const MINOR_SCALE = 100

/** 整数分 → 元（数字）。null 原样透传，让空值在表里就是空格而不是 0.00。 */
export function minorToNumber(minor: bigint | null | undefined): number | null {
  if (minor === null || minor === undefined) return null
  return new Decimal(minor.toString()).div(MINOR_SCALE).toNumber()
}

/** decimal 字符串 → 数字。解析不了就返回 null，不要把 'N/A' 变成 0。 */
export function decimalToNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === '') return null
  try {
    return new Decimal(value).toNumber()
  } catch {
    return null
  }
}

/** 万分比 → 百分比文字，如 1300 → '13%'、350 → '3.5%'。 */
export function bpsToPercent(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) return ''
  return `${new Decimal(bps).div(100).toDecimalPlaces(2).toString()}%`
}

/** 日期 → YYYY-MM-DD。空值给空串，模板上就是一片空白而不是 'null'。 */
export function toDateText(value: Date | null | undefined): string {
  if (!value) return ''
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

/** 汇率等高精度小数：保持字符串，不做数字化——它是快照，不参与表内计算。 */
export function toRateText(value: { toString(): string } | null | undefined): string {
  return value === null || value === undefined ? '' : value.toString()
}
