export { TimelineModule } from './timeline.module'
export { DocTimelineService, type EnterNodeInput } from './services/doc-timeline.service'
/** 节点视图的通用形状与铺法：三个模块曾各抄一份，差别只在固定节点清单 */
export {
  toTimelineNodeViews,
  type CanonicalNode,
  type DocTimelineNodeView,
} from './services/timeline-node.mapper'
export {
  DOC_TIMELINE_REPOSITORY,
  type DocTimelineRepositoryPort,
  type TimelineNodeRecord,
} from './repositories/doc-timeline.repository.port'
