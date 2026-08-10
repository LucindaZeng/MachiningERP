/**
 * 节点计时的对外形状，对齐前端 `TimelineNode`。
 * 耗时由平台 timeline 服务算好，这里只做单位换算（毫秒 → 小时）。
 */
export interface DocTimelineNodeView {
  node: string
  owner: string
  state: 'done' | 'active' | 'pending' | 'overdue'
  enteredAt?: string
  finishedAt?: string
  elapsedHours?: number
  remark?: string
}
