/**
 * 业务部（销售）领域契约类型。
 * 报价/核价/客户/订单沿用 docs/workflows/order-to-pack-lifecycle.md 的 QTN / ENG / ORD 节点定义；
 * 销货 SHP、销退 RMA、报关 EXP 为本轮补充设计，见 docs/product/business-department.md。
 * M0 完成后整体迁移至 packages/shared。
 */

/** 统一单据状态机（docs/product/department-control-matrix.md 统一审核权限规则） */
export type DocStatus =
  | 'draft'
  | 'submitted'
  | 'reviewing'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'closed'
  | 'rejected'
  | 'void'

/** 金额一律字符串定点数 + 币种（api-conventions.md） */
export interface Money {
  amount: string
  currency: string
}

/** 预警等级与待办/预警形状已迁到 shared（前后端共享契约），这里再导出保持引用路径不变。 */
export type { AlertItem, AlertLevel, TodoItem } from '@machining-erp/shared'

export type TimelineState = 'done' | 'active' | 'pending' | 'overdue'

/** 节点计时：口径见 lifecycle 文档「12 个计时字段」 */
export interface TimelineNode {
  node: string
  owner: string
  state: TimelineState
  enteredAt?: string
  firstViewedAt?: string
  finishedAt?: string
  dueAt?: string
  /** 节点总历时（小时） */
  elapsedHours?: number
  /** 超期时长（小时） */
  overdueHours?: number
  remark?: string
}


