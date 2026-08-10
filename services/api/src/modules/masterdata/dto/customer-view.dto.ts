import type { CustomerContract } from '@machining-erp/shared'

/**
 * 客户档案的对外表示。契约的唯一权威在 `@machining-erp/shared`，
 * 前后端共用同一份；这里只做别名，方便模块内引用。
 *
 * 财务字段在无 `customer.finance.view` 权限时按后 4 位打码——
 * 裁剪逻辑见 services/customer-visibility.ts。
 */
export type CustomerView = CustomerContract
