import type { DocTimelineNodeView } from './doc-timeline-node-view.dto'
import type { ShipmentLineView } from './shipment-line-view.dto'
import type { Money } from '@machining-erp/shared'

/**
 * 出货单对外形状，逐字对齐前端 `Shipment`（界面是设计基线）。
 *
 * 表头的 orderedQty / qualifiedQty / packedQty / shippedQty / tailQty
 * 都是明细行的合计——单产品出货也照样写一行，所以聚合口径只有一套。
 */
export interface ShipmentView {
  id: string
  docNo: string
  orderNo: string
  customerName: string
  productName: string
  lines?: ShipmentLineView[]
  batchNo: string
  orderedQty: string
  qualifiedQty: string
  packedQty: string
  shippedQty: string
  tailQty: string
  tailPlan?: 'rework' | 'stock' | 'direct-stock' | 'scrap'
  packedAt?: string
  shippedAt?: string
  signedAt?: string
  carrier?: string
  trackingNo?: string
  invoiceNo?: string
  amount: Money
  status: 'planned' | 'picking' | 'packed' | 'shipped' | 'signed' | 'invoiced' | 'closed'
  owner: string
  timeline: DocTimelineNodeView[]
  /** 乐观锁版本，动作端点回传 */
  versionLock: number
}
