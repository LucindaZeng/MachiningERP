import { parseDecimal } from '@machining-erp/shared'
import Decimal from 'decimal.js'

export interface StockBlendInput {
  /** 订单总数量 */
  orderQty: string
  /** 备料订单当前可领用数量 */
  availableQty: string
  /** 备料单件成本 */
  stockUnitCostMinor: bigint
  /** 本单新生产的单件成本 */
  produceUnitCostMinor: bigint
}

export interface StockBlendResult {
  /** 本次实际领用的备料数量 = min(订单数量, 可领用数量) */
  consumedQty: string
  /** 需新投产数量 = 订单数量 − 领用数量 */
  produceQty: string
  /** 加权平均单件成本（整数最小货币单位） */
  blendedUnitCostMinor: bigint
  /** 全精度加权成本，供后续继续参与计算时使用 */
  exactBlendedUnitCost: string
}

/**
 * 备料领用与加权平均成本（业务规格 4.5）。
 *
 * > 平均生产成本 =（备料单件成本 × 消耗备料数量 + 本单单件生产成本 × 新生产数量）÷ 订单总数量
 * >
 * > 例：订单 100 个，备料剩 20 个（单件 10 元），继续生产 80 个（单件 12 元），
 * > 则 =（10×20 + 12×80）÷ 100 = 11.6 元/件
 *
 * 两个容易写错的地方：
 *
 * 1. **优先消耗备料，直到用完**——领用量取 min(订单量, 备料余量)，而不是「按比例分摊」；
 *    备料够用时新产数量为 0，加权成本就等于备料成本。
 * 2. 除法用 decimal 全精度再取整到分。分子分母都是整数时看不出差别，
 *    但订单量一旦是 3、7 这类除不尽的数，先取整会让每件差一分。
 */
export function blendStockCost(input: StockBlendInput): StockBlendResult {
  const orderQty = parseDecimal(input.orderQty, '订单数量')
  const available = Decimal.max(parseDecimal(input.availableQty, '可领用数量'), 0)

  const consumed = Decimal.min(orderQty, available)
  const produce = orderQty.sub(consumed)

  const stockAmount = consumed.mul(input.stockUnitCostMinor.toString())
  const produceAmount = produce.mul(input.produceUnitCostMinor.toString())
  // 订单数量为 0 时没有「单件」可言，直接给 0，而不是让除法抛 DivisionByZero
  const blended = orderQty.lessThanOrEqualTo(0)
    ? new Decimal(0)
    : stockAmount.add(produceAmount).div(orderQty)

  return {
    consumedQty: consumed.toFixed(),
    produceQty: produce.toFixed(),
    blendedUnitCostMinor: BigInt(blended.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0)),
    exactBlendedUnitCost: blended.toFixed(),
  }
}

/**
 * 备料订单是否已被用完。剩余量归零即 CONSUMED，
 * 用「不大于 0」而不是「等于 0」，避免浮点或超领留下 -0.000001 这类残值。
 */
export function isStockExhausted(availableQty: string): boolean {
  return parseDecimal(availableQty, '可领用数量').lessThanOrEqualTo(0)
}

/** 领用后的剩余量，永不为负。 */
export function remainingAfter(availableQty: string, consumedQty: string): string {
  const remaining = parseDecimal(availableQty, '可领用数量').sub(
    parseDecimal(consumedQty, '领用数量'),
  )
  return Decimal.max(remaining, 0).toFixed()
}
