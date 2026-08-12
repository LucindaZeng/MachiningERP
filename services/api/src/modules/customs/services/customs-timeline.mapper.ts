import {
  toTimelineNodeViews,
  type DocTimelineNodeView,
  type TimelineNodeRecord,
} from '../../../platform/timeline'
import { CUSTOMS_TIMELINE_NODES } from '../constants/customs-timeline'

/**
 * EXP-01~04 的固定顺序；铺法走平台通用实现。
 *
 * 「关务复核不可跳过」这条因此在界面上是**看得见**的：
 * 复核节点没进过，时间线上那一格就一直是 pending。
 */
const CANONICAL_NODES = Object.values(CUSTOMS_TIMELINE_NODES)

export function toCustomsTimelineView(
  records: readonly TimelineNodeRecord[],
  fallbackOwner: string,
): DocTimelineNodeView[] {
  return toTimelineNodeViews(records, CANONICAL_NODES, fallbackOwner)
}
