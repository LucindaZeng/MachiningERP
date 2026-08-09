import { request } from '../http'

import type { Customer, CustomerCompleteness } from '@/types/sales.types'

/**
 * GET /customers —— 客户主数据（ENG-01）。
 *
 * 后端按统一分页包裹返回 `{ data, meta }`，`request()` 已经解包 `data`，
 * 所以这里直接拿到当前页的客户数组；分页 meta 暂时用不到（列表页仍是前端筛选）。
 *
 * 返回体已经由后端按权限裁剪：无 `sales.hk-price.view` 时 `hk` 整组缺席，
 * 无 `customer.finance.view` 时税号与银行账号只给后 4 位。前端不再自行推导。
 */
export function fetchCustomers(): Promise<Customer[]> {
  return request<Customer[]>({ method: 'GET', url: '/customers' })
}

/** GET /customers/:id —— 客户详情；越权时后端返回 404 而不是 403 */
export function fetchCustomer(id: string): Promise<Customer> {
  return request<Customer>({ method: 'GET', url: `/customers/${id}` })
}

/** GET /customers/:id/completeness —— 下单前档案完整性检查，缺失项用于下单拦截提示 */
export function fetchCustomerCompleteness(id: string): Promise<CustomerCompleteness> {
  return request<CustomerCompleteness>({ method: 'GET', url: `/customers/${id}/completeness` })
}
