/**
 * 业务部工作台聚合数据（指标、待办、预警、审批时效）。
 *
 * 前后端共享的线上契约（development-guide §1）。
 */

import type { PanelAvailability } from './panel-availability'

export interface KpiCard {
  key: string
  label: string
  value: string
  unit: string
  trend: string
  trendUp: boolean
  hint: string
}

export interface ApprovalEfficiency {
  node: string
  median: string
  p90: string
  onTimeRate: number
  returnRate: number
  backlog: number
}

/**
 * 工作台聚合响应。
 *
 * 待办与预警沿用前端既有的 `TodoItem` / `AlertItem` 形状——**前端是基线**，
 * 后端照着它建；另造一套只会逼着页面改写。两个形状因此一并迁到 shared。
 *
 * 依赖未上线模块的卡片按 `pending` 约定留空并说明，绝不零填。
 */
export interface SalesWorkbench extends PanelAvailability {
  kpis: KpiCard[]
  todos: TodoItem[]
  alerts: AlertItem[]
  approvals: ApprovalEfficiency[]
}

export type AlertLevel = 'info' | 'due' | 'overdue' | 'severe' | 'blocking'

/** 待办：压在业务员手上的单据，逐条可点开。 */
export interface TodoItem {
  id: string
  category: string
  title: string
  docNo: string
  customer: string
  dueAt: string
  level: AlertLevel
  route: string
}

/** 预警：由平台通知流与单据超期推导，业务侧不另建预警表。 */
export interface AlertItem {
  id: string
  level: AlertLevel
  domain: string
  subject: string
  triggerValue: string
  threshold: string
  occurredAt: string
  dueAt: string
  owner: string
  escalateTo: string
  relatedDocNo: string
  suggestion: string
}
