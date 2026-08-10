import { SHIPMENT_TIMELINE_NODES } from '../constants/shipment-timeline'

import type { TimelineNodeRecord } from '../../../platform/timeline'
import type { DocTimelineNodeView } from '../dto/doc-timeline-node-view.dto'

const MS_PER_HOUR = 3_600_000

/** SHP-01~06 的固定顺序；没有记录的节点补成 pending，界面才有完整的六格。 */
const CANONICAL_NODES = Object.values(SHIPMENT_TIMELINE_NODES)

function stateOf(record: TimelineNodeRecord): DocTimelineNodeView['state'] {
  if (record.status === 'ABNORMAL') return 'overdue'
  if (record.leftAt === null) return 'active'
  return 'done'
}

function toNodeView(record: TimelineNodeRecord, fallbackOwner: string): DocTimelineNodeView {
  const view: DocTimelineNodeView = {
    node: record.node,
    owner: record.ownerDept ?? record.ownerUserCode ?? fallbackOwner,
    state: stateOf(record),
  }
  view.enteredAt = record.enteredAt.toISOString()
  if (record.leftAt) view.finishedAt = record.leftAt.toISOString()
  if (record.durationMs !== null) {
    view.elapsedHours = Math.round((Number(record.durationMs) / MS_PER_HOUR) * 100) / 100
  }
  if (record.remark) view.remark = record.remark
  return view
}

/**
 * 把平台落库的节点记录铺成前端要的六格时间线。
 * 耗时一律取平台算好的 durationMs，本模块不自己减时间戳——
 * 两处各算一次迟早会算出两个答案。
 */
export function toShipmentTimelineView(
  records: readonly TimelineNodeRecord[],
  fallbackOwner: string,
): DocTimelineNodeView[] {
  const byNode = new Map(records.map((record) => [record.node, record]))

  return CANONICAL_NODES.map((canonical) => {
    const record = byNode.get(canonical.node)
    if (record) return toNodeView(record, fallbackOwner)
    return { node: canonical.node, owner: canonical.ownerDept, state: 'pending' as const }
  })
}
