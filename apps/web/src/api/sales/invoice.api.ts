import { request } from '../http'

import type { InvoiceRequest } from '@/types/sales.types'

export interface InvoiceQuery {
  customerId?: string
  status?: string
  invoiceKind?: string
}

function toQueryString(query: InvoiceQuery = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value)
  }
  const search = params.toString()
  return search ? `?${search}` : ''
}

/** GET /invoice-requests —— 发票申请（INV-01 ~ INV-04）。红字发票同列，金额为负。 */
export function fetchInvoiceRequests(query?: InvoiceQuery): Promise<InvoiceRequest[]> {
  return request<InvoiceRequest[]>({ method: 'GET', url: `/invoice-requests${toQueryString(query)}` })
}

export function fetchInvoiceRequest(id: string): Promise<InvoiceRequest> {
  return request<InvoiceRequest>({ method: 'GET', url: `/invoice-requests/${id}` })
}

/** 建单：只选客户与出货单，金额税率抬头全部由后端自动带出。 */
export function createInvoiceRequest(payload: {
  customerId: string
  shipmentIds: string[]
  statementId?: string
  statementTotalMinor?: string
}): Promise<InvoiceRequest> {
  return request<InvoiceRequest>({ method: 'POST', url: '/invoice-requests', body: payload })
}

export function submitInvoiceRequest(id: string, versionLock: number): Promise<InvoiceRequest> {
  return action(id, 'submit', { versionLock })
}

/** 送财务开票；三方金额不一致时后端在这一步拦下（ORD_2705）。 */
export function sendInvoiceToFinance(id: string, versionLock: number): Promise<InvoiceRequest> {
  return action(id, 'send-to-finance', { versionLock })
}

export function issueInvoice(
  id: string,
  versionLock: number,
  invoiceNo: string,
): Promise<InvoiceRequest> {
  return action(id, 'issue', { versionLock, invoiceNo })
}

/** INV-04 寄出 / 签收：只推进时间线，状态仍是「已开票交付」。 */
export function markInvoiceSent(id: string, versionLock: number): Promise<InvoiceRequest> {
  return action(id, 'mark-sent', { versionLock })
}

export function markInvoiceSigned(id: string, versionLock: number): Promise<InvoiceRequest> {
  return action(id, 'mark-signed', { versionLock })
}

/** 作废：仅未开票前，理由必填。 */
export function voidInvoiceRequest(
  id: string,
  versionLock: number,
  reason: string,
): Promise<InvoiceRequest> {
  return action(id, 'void', { versionLock, reason })
}

/** 红冲：新开一张负数发票挂在原票下，原票不动。 */
export function createInvoiceCreditNote(
  id: string,
  reason: string,
  amountIncTaxMinor?: string,
): Promise<InvoiceRequest> {
  return request<InvoiceRequest>({
    method: 'POST',
    url: `/invoice-requests/${id}/credit-note`,
    body: { reason, amountIncTaxMinor },
  })
}

function action(id: string, verb: string, body: Record<string, unknown>): Promise<InvoiceRequest> {
  return request<InvoiceRequest>({ method: 'POST', url: `/invoice-requests/${id}/${verb}`, body })
}
