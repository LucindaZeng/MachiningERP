import { request } from '../http'
import type { HkPricing, OrderChangeRequest, OrderType, SalesOrder } from '@/types/sales.types'

export interface HkCalculateInput {
  customerCode: string
  orderType: OrderType
  originalUnitPrice: string
  quantity: string
}

/** GET /sales-orders —— 业务订单列表（ORD-01~04） */
export function fetchSalesOrders(): Promise<SalesOrder[]> {
  return request<SalesOrder[]>({ method: 'GET', url: '/sales-orders' })
}

/** POST /hk-pricing/calculate —— 香港客户 70% 价格试算与适用性校验 */
export function calculateHkPrice(input: HkCalculateInput): Promise<HkPricing> {
  return request<HkPricing>({ method: 'POST', url: '/hk-pricing/calculate', body: input })
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
