import { request } from '../http'

import type { InvoiceRequest } from '@/types/sales.types'

/** GET /invoice-requests —— 发票申请（INV-01 ~ INV-04） */
export function fetchInvoiceRequests(): Promise<InvoiceRequest[]> {
  return request<InvoiceRequest[]>({ method: 'GET', url: '/invoice-requests' })
}
