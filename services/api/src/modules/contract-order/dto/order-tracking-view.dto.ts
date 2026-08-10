import type { TrackingNodeView } from './tracking-node-view.dto'

/** 一个产品行的追踪视图。一单多产品时按行分别追踪。 */
export interface OrderLineTrackingView {
  orderLineId: string
  productName: string
  drawingNo: string
  quantity: string
  currentNode: string | null
  /** 已完成节点数 / 总节点数——同样是计数，不是比例 */
  doneNodes: number
  totalNodes: number
  hasBlocked: boolean
  nodes: TrackingNodeView[]
}
