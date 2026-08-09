import { request } from '../http'
import type { EngineeringChange } from '@/types/sales.types'

/** GET /engineering-changes —— 工程变更申请（ECN-01~05） */
export function fetchEngineeringChanges(): Promise<EngineeringChange[]> {
  return request<EngineeringChange[]>({ method: 'GET', url: '/engineering-changes' })
}
