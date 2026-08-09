import { request } from '../http'

import type { SalesReturn } from '@/types/sales.types'

/** GET /sales-returns —— 销退 / RMA 列表（RMA-01~05，本轮补充设计） */
export function fetchSalesReturns(): Promise<SalesReturn[]> {
  return request<SalesReturn[]>({ method: 'GET', url: '/sales-returns' })
}
