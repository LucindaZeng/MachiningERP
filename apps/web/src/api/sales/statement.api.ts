import { request } from '../http'

import type { Statement } from '@/types/sales.types'

export interface StatementQuery {
  customerId?: string
  status?: string
  /** 只看每个客户 + 期间的最新版本 */
  latestOnly?: boolean
}

function toQueryString(query: StatementQuery = {}): string {
  const params = new URLSearchParams()
  if (query.customerId) params.set('customerId', query.customerId)
  if (query.status) params.set('status', query.status)
  if (query.latestOnly) params.set('latestOnly', 'true')

  const search = params.toString()
  return search ? `?${search}` : ''
}

/** GET /statements/customer —— 客户对账单（STM-01~05） */
export function fetchStatements(query?: StatementQuery): Promise<Statement[]> {
  return request<Statement[]>({ method: 'GET', url: `/statements/customer${toQueryString(query)}` })
}

/** GET /statements/:id —— 对账单详情 */
export function fetchStatement(id: string): Promise<Statement> {
  return request<Statement>({ method: 'GET', url: `/statements/${id}` })
}

/**
 * POST /statements/generate —— 按客户与期间从源单生成。
 * 重算会产出新版本，已发出的那一版原样保留（客户签回的凭据不能被改）。
 */
export function generateStatement(payload: {
  customerId: string
  periodFrom: string
  periodTo: string
  basis?: 'SHIPMENT' | 'INVOICE'
  customerClosingMinor?: string
}): Promise<Statement> {
  return request<Statement>({ method: 'POST', url: '/statements/generate', body: payload })
}

export function sendStatement(id: string, versionLock: number): Promise<Statement> {
  return action(id, 'send', { versionLock })
}

export function confirmStatement(id: string, versionLock: number): Promise<Statement> {
  return action(id, 'confirm', { versionLock })
}

/** 客户提出差异：说明必填，差异回到源单处理后重新发出。 */
export function disputeStatement(
  id: string,
  versionLock: number,
  differenceNote: string,
): Promise<Statement> {
  return action(id, 'dispute', { versionLock, differenceNote })
}

export function settleStatement(id: string, versionLock: number): Promise<Statement> {
  return action(id, 'settle', { versionLock })
}

/** 标记某行客户是否已核对——对账单上唯一允许人工改的字段。 */
export function setStatementLineMatched(
  id: string,
  lineId: string,
  matched: boolean,
): Promise<Statement> {
  return request<Statement>({
    method: 'PUT',
    url: `/statements/${id}/lines/${lineId}/matched`,
    body: { matched },
  })
}

function action(id: string, verb: string, body: Record<string, unknown>): Promise<Statement> {
  return request<Statement>({ method: 'POST', url: `/statements/${id}/${verb}`, body })
}
