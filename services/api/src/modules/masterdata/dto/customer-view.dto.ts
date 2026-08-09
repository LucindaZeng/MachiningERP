import type { CustomerContract } from '@machining-erp/shared'

/**
 * 客户档案的对外表示。契约的唯一权威在 `@machining-erp/shared`，
 * 前后端共用同一份；这里只做别名，方便模块内引用。
 *
 * `hk` 整组在无 `sales.hk-price.view` 权限时**缺席**而不是给假值——
 * 裁剪逻辑见 services/customer-visibility.ts。
 */
export type CustomerView = CustomerContract
