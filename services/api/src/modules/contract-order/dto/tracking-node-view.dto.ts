/**
 * 追踪节点的对外表示。
 *
 * **只有完成数与工单数两个数字，没有百分比字段**（业务规格 4.7）。
 * 契约里不提供比例，前端就无从把 58/100 渲染成 58%。
 */
export interface TrackingNodeView {
  sequence: number
  node: string
  phase: string
  department: string
  status: string
  /** 完成数 */
  done: string
  /** 工单数 */
  total: string
  ngQty: string
  startedAt: string | null
  finishedAt: string | null
  dwellHours: number | null
}
