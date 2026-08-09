import Decimal from 'decimal.js'

/**
 * 金额舍入模式。财务口径默认「四舍五入」（HALF_UP），
 * 成本分摊等需要保证合计不失衡的场景由 allocate() 处理余数，不靠舍入模式兜底。
 */
export type RoundingMode = 'HALF_UP' | 'HALF_EVEN' | 'UP' | 'DOWN'

const DECIMAL_ROUNDING: Record<RoundingMode, Decimal.Rounding> = {
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
  UP: Decimal.ROUND_CEIL,
  DOWN: Decimal.ROUND_FLOOR,
}

export function toDecimalRounding(mode: RoundingMode): Decimal.Rounding {
  return DECIMAL_ROUNDING[mode]
}

export const DEFAULT_ROUNDING: RoundingMode = 'HALF_UP'
