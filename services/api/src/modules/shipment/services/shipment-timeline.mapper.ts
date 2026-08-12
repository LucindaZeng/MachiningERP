import {
  toTimelineNodeViews,
  type DocTimelineNodeView,
  type TimelineNodeRecord,
} from '../../../platform/timeline'
import { SHIPMENT_TIMELINE_NODES } from '../constants/shipment-timeline'

/** SHP-01~06 的固定顺序；铺法走平台通用实现。 */
const CANONICAL_NODES = Object.values(SHIPMENT_TIMELINE_NODES)

export function toShipmentTimelineView(
  records: readonly TimelineNodeRecord[],
  fallbackOwner: string,
): DocTimelineNodeView[] {
  return toTimelineNodeViews(records, CANONICAL_NODES, fallbackOwner)
}
