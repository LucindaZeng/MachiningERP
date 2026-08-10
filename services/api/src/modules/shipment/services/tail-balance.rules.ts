import { addQuantity, parseDecimal, quantityOf, subtractQuantity } from '@machining-erp/shared'

const ZERO = quantityOf('0')

/**
 * 尾数与结案数量平衡（V2.4 尾数规则）。
 *
 * 尾数 = 订单数 − 已发数。四条路径（返工补交 / 入库 / 直接入库 / 报废）
 * 都是「把尾数结清」的方式，区别只在货去哪儿。结案的硬条件是：
 *
 *   订单数 = 已发数 + 已处置尾数
 *
 * 少了这条校验，一张单可以在尾数悬空的状态下 CLOSED，
 * 那批货就此从账上消失——既不在库存也不在应收里。
 */

export interface TailLineFacts {
  sequence: number
  productName: string
  orderedQty: string
  shippedQty: string
  tailResolvedQty: string
  tailPlan: string | null
}

export interface TailImbalance {
  sequence: number
  productName: string
  outstandingQty: string
}

/** 单行尾数：订单数 − 已发数，负数按 0 处理（超发由建单校验拦，不在这里兜） */
export function tailQtyOf(line: Pick<TailLineFacts, 'orderedQty' | 'shippedQty'>): string {
  const tail = subtractQuantity(line.orderedQty, line.shippedQty)
  return parseDecimal(tail, '尾数').isNegative() ? ZERO : tail
}

/** 单行还欠多少没结清：尾数 − 已处置数量。 */
export function outstandingTailOf(line: TailLineFacts): string {
  const outstanding = subtractQuantity(tailQtyOf(line), line.tailResolvedQty)
  return parseDecimal(outstanding, '未结尾数').isNegative() ? ZERO : outstanding
}

export function hasOutstandingTail(line: TailLineFacts): boolean {
  return parseDecimal(outstandingTailOf(line), '未结尾数').greaterThan(0)
}

/** 结案前的数量平衡校验：返回所有还没结清的行，空数组即可结案。 */
export function collectTailImbalances(lines: readonly TailLineFacts[]): TailImbalance[] {
  return lines.filter(hasOutstandingTail).map((line) => ({
    sequence: line.sequence,
    productName: line.productName,
    outstandingQty: outstandingTailOf(line),
  }))
}

/** 整单尾数合计，供列表页与 DTO 的表头聚合使用。 */
export function totalTailQty(lines: readonly TailLineFacts[]): string {
  return lines.reduce(
    (sum, line) => addQuantity(sum, tailQtyOf(line)),
    ZERO,
  )
}
