import { request } from '../http'

import type { Statement } from '@/types/sales.types'

/** GET /statements/customer —— 客户对账单（STM-01~05） */
export function fetchStatements(): Promise<Statement[]> {
  return request<Statement[]>({ method: 'GET', url: '/statements/customer' })
}
