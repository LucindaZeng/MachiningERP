import type { HkPricing, OrderLine, StockLink, StockOrder } from '@/types/sales.types'

/** 金额口径全局统一在这里：数量 × 单价，两位小数，避免各处 toFixed 参数不一致 */
export function lineAmount(line: OrderLine): string {
  return (Number(line.quantity || '0') * Number(line.unitPrice || '0')).toFixed(2)
}

export function sumLineQty(lines: OrderLine[]): number {
  return lines.reduce((sum, line) => sum + Number(line.quantity || '0'), 0)
}

export function sumLineAmount(lines: OrderLine[]): number {
  return lines.reduce(
    (sum, line) => sum + Number(line.quantity || '0') * Number(line.unitPrice || '0'),
    0,
  )
}

/**
 * HK 70% 一致性：原始价 × 系数必须等于计算后价格。
 * 业务如果自己先手工乘过 70% 再录入，系统再折一次就是重复折算，这里用半分钱容差兜住浮点误差。
 */
export function isHkPriceConsistent(hk: HkPricing | null): boolean {
  if (!hk) {
    return true
  }
  const expected = Number(hk.originalUnitPrice) * hk.factor
  return Math.abs(expected - Number(hk.finalUnitPrice)) < 0.005
}

/**
 * 备料领用与加权平均成本：(备料单价 × 领用数 + 新产单价 × 新产数) / 订单数量。
 * 领用数取备料余量与订单数量的较小值——余量不足时差额必须新投产，成本按加权摊回订单。
 */
export function computeStockUsage(
  stock: StockOrder | undefined,
  quantity: string,
  produceUnitCost: string,
): StockLink | null {
  const orderQty = Number(quantity || '0')
  if (!stock || !orderQty) {
    return null
  }
  const usedQty = Math.min(orderQty, Number(stock.remainingQty))
  const produceQty = orderQty - usedQty
  const unitCost = Number(produceUnitCost || '0')
  const blended = (Number(stock.unitCost) * usedQty + unitCost * produceQty) / orderQty
  return {
    stockOrderNo: stock.docNo,
    usedQty: String(usedQty),
    stockUnitCost: stock.unitCost,
    produceQty: String(produceQty),
    produceUnitCost: unitCost.toFixed(2),
    blendedUnitCost: blended.toFixed(2),
  }
}
