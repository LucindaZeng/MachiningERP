import { request } from '../http'
import type { Customer } from '@/types/sales.types'

/** GET /customers —— 客户主数据（ENG-01，财务字段按字段权限裁剪） */
export function fetchCustomers(): Promise<Customer[]> {
  return request<Customer[]>({ method: 'GET', url: '/customers' })
}
