import { request } from '../http'

import type { OrderTracking } from '@/types/sales.types'

/** GET /order-trackings —— 订单追踪（业务部、总经办、PMC 共享视图） */
export function fetchOrderTrackings(): Promise<OrderTracking[]> {
  return request<OrderTracking[]>({ method: 'GET', url: '/order-trackings' })
}
