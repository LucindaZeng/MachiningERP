import type { OrderLineProgress } from './tracking-progress'
import type { OrderLineTrackingView } from '../dto/order-tracking-view.dto'
import type { TrackingNodeView } from '../dto/tracking-node-view.dto'
import type { SalesOrderLineRecord } from '../repositories/sales-order.repository.port'

/**
 * 进度 → 对外表示。
 *
 * 这里刻意**不做任何除法**：`done` 与 `total` 原样透出，
 * 百分比在整条链路上都不存在（业务规格 4.7）。
 */
function toNodeView(node: OrderLineProgress['nodes'][number]): TrackingNodeView {
  return {
    sequence: node.sequence,
    node: node.node,
    phase: node.phase,
    department: node.department,
    status: node.status,
    done: node.done,
    total: node.total,
    ngQty: node.ngQty,
    startedAt: node.startedAt?.toISOString() ?? null,
    finishedAt: node.finishedAt?.toISOString() ?? null,
    dwellHours: node.dwellHours,
  }
}

export function toLineTrackingView(
  line: SalesOrderLineRecord,
  progress: OrderLineProgress,
): OrderLineTrackingView {
  return {
    orderLineId: line.id,
    productName: line.productName,
    drawingNo: line.drawingNo,
    quantity: line.quantity,
    currentNode: progress.currentNode,
    doneNodes: progress.doneNodes,
    totalNodes: progress.totalNodes,
    hasBlocked: progress.hasBlocked,
    nodes: progress.nodes.map(toNodeView),
  }
}
