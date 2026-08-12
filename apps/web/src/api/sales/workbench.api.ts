import { request } from '../http'

import type { SalesWorkbench } from '@machining-erp/shared'

export type { SalesWorkbench }

/** GET /sales/workbench —— 业务部工作台聚合数据（指标、待办、预警、审批时效） */
export function fetchSalesWorkbench(): Promise<SalesWorkbench> {
  return request<SalesWorkbench>({ method: 'GET', url: '/sales/workbench' })
}
