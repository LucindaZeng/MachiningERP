import type { Money, TimelineNode } from './common.types'

/* ------------------------------ 销货 SHP（本轮补充） ------------------------------ */

export type ShipmentStatus =
  | 'planned'
  | 'picking'
  | 'packed'
  | 'shipped'
  | 'signed'
  | 'invoiced'
  | 'closed'

/** 出货明细行：一张发货单可以发多项产品 */
export interface ShipmentLine {
  seq: number
  productName: string
  drawingNo: string
  itemCode?: string
  batchNo: string
  orderedQty: string
  shippedQty: string
  tailQty: string
  amount: string
}

/** 退货明细行：一张退货单可以退多项产品 */
export interface ReturnLine {
  seq: number
  productName: string
  drawingNo: string
  batchNo: string
  returnQty: string
  reason: string
  amount: string
}

export interface Shipment {
  id: string
  docNo: string
  orderNo: string
  customerName: string
  productName: string
  /** 一单多产品明细；单产品出货也写一行 */
  lines?: ShipmentLine[]
  batchNo: string
  orderedQty: string
  qualifiedQty: string
  packedQty: string
  shippedQty: string
  /** 尾数 = 订单数 − 已发数，四路径处理 */
  tailQty: string
  tailPlan?: 'rework' | 'stock' | 'direct-stock' | 'scrap'
  packedAt?: string
  shippedAt?: string
  signedAt?: string
  carrier?: string
  trackingNo?: string
  invoiceNo?: string
  amount: Money
  status: ShipmentStatus
  owner: string
  timeline: TimelineNode[]
}
