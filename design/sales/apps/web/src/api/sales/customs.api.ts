import { request } from '../http'
import type { CustomsDossier } from '@/types/sales.types'

export interface RenderedDocument {
  templateCode: string
  version: string
  generatedAt: string
  downloadUrl: string
}

/** GET /customs-dossiers —— 报关资料包（EXP-01~04，本轮补充设计） */
export function fetchCustomsDossiers(): Promise<CustomsDossier[]> {
  return request<CustomsDossier[]>({ method: 'GET', url: '/customs-dossiers' })
}

/** POST /documents/render —— 由 docgen 统一出文件，返回短时效下载链接并留版本快照 */
export function renderCustomsDocument(templateCode: string): Promise<RenderedDocument> {
  return request<RenderedDocument>({
    method: 'POST',
    url: '/documents/render',
    body: { templateCode },
  })
}
