import type { Money } from '@machining-erp/shared'

/** 可领用的备料订单。数量是 decimal 字符串，金额是定点字符串 + 币种。 */
export interface StockPrepAvailabilityView {
  orderId: string
  docNo: string
  drawingNo: string
  totalQty: string
  consumedQty: string
  availableQty: string
  unitCost: Money
  stockStatus: string | null
}
