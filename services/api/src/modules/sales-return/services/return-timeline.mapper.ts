import {
  toTimelineNodeViews,
  type DocTimelineNodeView,
  type TimelineNodeRecord,
} from '../../../platform/timeline'
import { RETURN_TIMELINE_NODES } from '../constants/return-timeline'

/**
 * RMA-01~05 的固定顺序；铺法走平台通用实现。
 *
 * 首响 SLA（fixture 里「2 小时首响 SLA 内完成」）因此是**算出来的**：
 * 耗时取平台算好的 durationMs，本模块不自己减时间戳。
 */
const CANONICAL_NODES = Object.values(RETURN_TIMELINE_NODES)

export function toReturnTimelineView(
  records: readonly TimelineNodeRecord[],
  fallbackOwner: string,
): DocTimelineNodeView[] {
  return toTimelineNodeViews(records, CANONICAL_NODES, fallbackOwner)
}
