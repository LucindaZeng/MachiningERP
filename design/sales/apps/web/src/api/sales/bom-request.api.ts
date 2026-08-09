import { request } from '../http'
import type { BomRequest } from '@/types/sales.types'

/** GET /bom-requests —— BOM 申请列表（ENG-02 提交 / ENG-05 回传双状态） */
export function fetchBomRequests(): Promise<BomRequest[]> {
  return request<BomRequest[]>({ method: 'GET', url: '/bom-requests' })
}
