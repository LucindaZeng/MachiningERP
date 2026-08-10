import { request } from '../http'

import type { ReturnDisposition, ReturnResponsibility, SalesReturn } from '@/types/sales.types'

export interface SalesReturnQuery {
  customerId?: string
  orderId?: string
  shipmentId?: string
  status?: string
  closedFrom?: string
  closedTo?: string
}

function toQueryString(query: SalesReturnQuery = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value)
  }
  const search = params.toString()
  return search ? `?${search}` : ''
}

/** GET /sales-returns —— 销退 / RMA 列表（RMA-01~05）。 */
export function fetchSalesReturns(query?: SalesReturnQuery): Promise<SalesReturn[]> {
  return request<SalesReturn[]>({ method: 'GET', url: `/sales-returns${toQueryString(query)}` })
}

export function fetchSalesReturn(id: string): Promise<SalesReturn> {
  return request<SalesReturn>({ method: 'GET', url: `/sales-returns/${id}` })
}

export interface RegisterReturnLine {
  sequence: number
  shipmentLineId: string
  orderLineId?: string
  productName: string
  drawingNo: string
  batchNo: string
  returnQty: string
  unitPriceMinor: string
  amountMinor: string
  reason: string
}

/**
 * RMA-01 登记客诉 / 退货。
 * 客户、订单、币种由后端从**原出货单**带出——前端能传的东西，前端就能传错。
 */
export function registerSalesReturn(payload: {
  shipmentId: string
  reason: string
  complaintAt: string
  eightDNo?: string
  eightDRequired?: boolean
  lines: RegisterReturnLine[]
}): Promise<SalesReturn> {
  return request<SalesReturn>({ method: 'POST', url: '/sales-returns', body: payload })
}

/** RMA-01→02 首次响应客户并转品质判定。SLA 口径，天然只有一次。 */
export function respondToReturn(id: string, versionLock: number): Promise<SalesReturn> {
  return action(id, 'respond', { versionLock })
}

/** RMA-02 品质**逐行**判定责任归属——一张单里本厂与委外责任可以并存。 */
export function judgeReturn(
  id: string,
  versionLock: number,
  lines: Array<{ lineId: string; responsibility: Uppercase<ReturnResponsibility> }>,
): Promise<SalesReturn> {
  return action(id, 'judge', { versionLock, lines })
}

/**
 * RMA-03 提交**逐行**处置方案。
 * 是否需要财务审批由处置组合在后端推导，前端勾不了。
 * 让步接收必须带 `allowanceMinor`（谈定的减价额），退款 / 让步 / 报废必须带理由。
 */
export function submitReturnDisposition(
  id: string,
  versionLock: number,
  lines: Array<{
    lineId: string
    disposition: Uppercase<ReturnDisposition>
    dispositionNote?: string
    allowanceMinor?: string
  }>,
): Promise<SalesReturn> {
  return action(id, 'disposition', { versionLock, lines })
}

export function approveReturnDisposition(id: string, versionLock: number): Promise<SalesReturn> {
  return action(id, 'approve', { versionLock })
}

/** 判定客诉不成立。理由必填。 */
export function rejectReturn(
  id: string,
  versionLock: number,
  reason: string,
): Promise<SalesReturn> {
  return action(id, 'reject', { versionLock, reason })
}

/** RMA-04 登记不良品实物入库；返工行必须先过这一步才能结案。 */
export function receiveReturnGoods(
  id: string,
  versionLock: number,
  lines: Array<{ lineId: string; receivedQty: string }>,
): Promise<SalesReturn> {
  return action(id, 'receive', { versionLock, lines })
}

/** RMA-05 结案。逐行闸门通过后**锁死金额**，对账单据此在结案期间计入退货折让。 */
export function closeReturn(id: string, versionLock: number): Promise<SalesReturn> {
  return action(id, 'close', { versionLock })
}

function action(id: string, verb: string, body: Record<string, unknown>): Promise<SalesReturn> {
  return request<SalesReturn>({ method: 'POST', url: `/sales-returns/${id}/${verb}`, body })
}
