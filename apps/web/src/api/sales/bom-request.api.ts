import { request } from '../http'

import type { BomRequest } from '@/types/sales.types'

/**
 * BOM 申请（ENG-02 提交 / ENG-05 工程回传双状态）。
 *
 * `bomReady` 与 `programReady` 是**两个独立开关**，后端分别下发，
 * 前端也必须分别展示，不得合并成「全部工程完成」。
 */
export function fetchBomRequests(params: BomRequestQuery = {}): Promise<BomRequest[]> {
  return request<BomRequest[]>({ method: 'GET', url: withQuery('/bom-requests', params) })
}

export interface BomRequestQuery extends Record<string, string | undefined> {
  customerId?: string
  status?: string
  productionType?: 'BATCH' | 'MOLD'
  ownerUserCode?: string
}

export function fetchBomRequest(id: string): Promise<BomRequest> {
  return request<BomRequest>({ method: 'GET', url: `/bom-requests/${id}` })
}

/** 提起 BOM 申请：引用报价单里的产品，图纸沿用报价环节的版本，不重复上传。 */
export function createBomRequest(body: Record<string, unknown>): Promise<BomRequest> {
  return request<BomRequest>({
    method: 'POST',
    url: '/bom-requests',
    body,
    idempotencyKey: `bomr-${String(body.quotationItemId ?? '')}-${String(body.quantity ?? '')}`,
  })
}

export function submitBomRequest(id: string, versionLock: number): Promise<BomRequest> {
  return request<BomRequest>({
    method: 'POST',
    url: `/bom-requests/${id}/submit`,
    body: { versionLock },
  })
}

/** 工程接收 */
export function claimBomRequest(id: string, versionLock: number): Promise<BomRequest> {
  return request<BomRequest>({
    method: 'POST',
    url: `/bom-requests/${id}/claim`,
    body: { versionLock },
  })
}

/** 工程退回补料，理由必填 */
export function returnBomRequest(
  id: string,
  versionLock: number,
  reason: string,
): Promise<BomRequest> {
  return request<BomRequest>({
    method: 'POST',
    url: `/bom-requests/${id}/return`,
    body: { versionLock, reason },
  })
}

/** BOM 建立完成并回填品号（模具为模具编号） */
export function completeBom(
  id: string,
  versionLock: number,
  productCode: string,
): Promise<BomRequest> {
  return request<BomRequest>({
    method: 'POST',
    url: `/bom-requests/${id}/complete-bom`,
    body: { versionLock, productCode },
  })
}

/** 加工程序完成——不影响能否下单 */
export function completeBomProgram(id: string, versionLock: number): Promise<BomRequest> {
  return request<BomRequest>({
    method: 'POST',
    url: `/bom-requests/${id}/complete-program`,
    body: { versionLock },
  })
}

function withQuery(url: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString()
  return search ? `${url}?${search}` : url
}
