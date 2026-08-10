import { request } from '../http'

import type { OrderChangeRequest, SalesOrder } from '@/types/sales.types'

/** GET /sales-orders —— 业务订单列表（ORD-01~04） */
export function fetchSalesOrders(): Promise<SalesOrder[]> {
  return request<SalesOrder[]>({ method: 'GET', url: '/sales-orders' })
}

/** POST /sales-orders —— 建单并提交业务经理审核（T0 起算） */
export function createSalesOrder(body: Record<string, unknown>): Promise<SalesOrder> {
  return request<SalesOrder>({
    method: 'POST',
    url: '/sales-orders',
    body,
    idempotencyKey: `so-${body.customerPoNo || body.drawingNo}-${body.quantity}`,
  })
}

/** GET /order-changes —— 订单修改申请（ORC，只改订单信息，不改产品） */
export function fetchOrderChanges(): Promise<OrderChangeRequest[]> {
  return request<OrderChangeRequest[]>({ method: 'GET', url: '/order-changes' })
}
