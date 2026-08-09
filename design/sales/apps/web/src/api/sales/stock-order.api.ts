import { request } from '../http'
import type { StockOrder } from '@/types/sales.types'

/** GET /stock-orders —— 备料订单库存（可被正式订单领用的余量） */
export function fetchStockOrders(): Promise<StockOrder[]> {
  return request<StockOrder[]>({ method: 'GET', url: '/stock-orders' })
}
