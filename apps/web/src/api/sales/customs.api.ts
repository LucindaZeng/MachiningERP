import { request } from '../http'

import type { CustomsDossier } from '@/types/sales.types'

export interface CustomsQuery {
  customerId?: string
  shipmentId?: string
  orderId?: string
  status?: string
}

function toQueryString(query: CustomsQuery = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value)
  }
  const search = params.toString()
  return search ? `?${search}` : ''
}

/** GET /customs-dossiers —— 报关资料包（EXP-01~04）。 */
export function fetchCustomsDossiers(query?: CustomsQuery): Promise<CustomsDossier[]> {
  return request<CustomsDossier[]>({ method: 'GET', url: `/customs-dossiers${toQueryString(query)}` })
}

export function fetchCustomsDossier(id: string): Promise<CustomsDossier> {
  return request<CustomsDossier>({ method: 'GET', url: `/customs-dossiers/${id}` })
}

/**
 * EXP-01 建档。客户、订单、币种由后端从**原出货单**带出，这里不传——
 * 报关单上的数量对不上出货单，是到口岸才会被发现的那种错。
 */
export function createCustomsDossier(payload: {
  shipmentId: string
  tradeMode: string
  incoterm: string
  portOfLoading: string
  destination: string
  destinationPortCode?: string
  shippingMarks?: string
  hsCode: string
  goodsNameCn: string
  goodsNameEn?: string
  quantity: string
  unit: string
  netWeight: string
  grossWeight: string
  packages: number
  unitPriceMinor: string
  totalAmountMinor: string
  exchangeRate: string
}): Promise<CustomsDossier> {
  return request<CustomsDossier>({ method: 'POST', url: '/customs-dossiers', body: payload })
}

/**
 * EXP-03 出具一份文件的新版本。**永远是追加**——旧版原样留着。
 * 要素不齐（后端会列出缺了哪些中文标签）或未过账时会被拒绝。
 */
export function generateCustomsDocument(
  id: string,
  versionLock: number,
  kind: CustomsDocKind,
  exchangeRate?: string,
): Promise<CustomsDossier> {
  return request<CustomsDossier>({
    method: 'POST',
    url: `/customs-dossiers/${id}/documents`,
    body: { versionLock, kind, ...(exchangeRate ? { exchangeRate } : {}) },
  })
}

export type CustomsDocKind =
  | 'PROFORMA_INVOICE'
  | 'COMMERCIAL_INVOICE'
  | 'PACKING_LIST'
  | 'CONTRACT'
  | 'DATA_PACK'

/** 模板编码 → 文件种类。服务端在文件位上下发 templateCode，页面据此调生成端点。 */
export const DOC_KIND_BY_TEMPLATE: Record<string, CustomsDocKind> = {
  'EXP-PIN': 'PROFORMA_INVOICE',
  'EXP-INV': 'COMMERCIAL_INVOICE',
  'EXP-PKL': 'PACKING_LIST',
  'EXP-CON': 'CONTRACT',
  'EXP-DEC': 'DATA_PACK',
}

export function submitCustomsForReview(id: string, versionLock: number): Promise<CustomsDossier> {
  return action(id, 'submit-review', { versionLock })
}

/** EXP-02 关务复核通过。复核不可跳过——未复核的资料申报端点会拒绝。 */
export function approveCustomsReview(id: string, versionLock: number): Promise<CustomsDossier> {
  return action(id, 'approve-review', { versionLock })
}

export function returnCustomsForFix(id: string, versionLock: number): Promise<CustomsDossier> {
  return action(id, 'return-for-fix', { versionLock })
}

/** EXP-04 申报：冻结本版清单快照，此后任何改动都要走更正。 */
export function declareCustoms(id: string, versionLock: number): Promise<CustomsDossier> {
  return action(id, 'declare', { versionLock })
}

/** EXP-04 更正已申报资料并重报。理由必填；改了哪几份由后端比对快照算出。 */
export function correctCustoms(
  id: string,
  versionLock: number,
  reason: string,
): Promise<CustomsDossier> {
  return action(id, 'correct', { versionLock, reason })
}

export function archiveCustomsReceipt(
  id: string,
  versionLock: number,
  receiptNo: string,
): Promise<CustomsDossier> {
  return action(id, 'receipt', { versionLock, receiptNo })
}

export function releaseCustoms(id: string, versionLock: number): Promise<CustomsDossier> {
  return action(id, 'release', { versionLock })
}

function action(id: string, verb: string, body: Record<string, unknown>): Promise<CustomsDossier> {
  return request<CustomsDossier>({ method: 'POST', url: `/customs-dossiers/${id}/${verb}`, body })
}
