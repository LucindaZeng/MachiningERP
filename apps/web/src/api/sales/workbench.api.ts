import { request } from '../http'

import type { ApprovalEfficiency, KpiCard } from '../mock/sales/workbench.fixture'
import type { AlertItem, TodoItem } from '@/types/sales.types'

export interface SalesWorkbench {
  kpis: KpiCard[]
  todos: TodoItem[]
  alerts: AlertItem[]
  approvals: ApprovalEfficiency[]
}

/** GET /sales/workbench —— 业务部工作台聚合数据（指标、待办、预警、审批时效） */
export function fetchSalesWorkbench(): Promise<SalesWorkbench> {
  return request<SalesWorkbench>({ method: 'GET', url: '/sales/workbench' })
}
