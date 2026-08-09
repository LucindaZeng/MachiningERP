/**
 * 业务部契约类型总出口。
 *
 * 按 11 个模块拆分到 `types/sales/` 下（单文件 ≤ 400 行，development-guide 3.3），
 * 本文件只做再导出，历史的 `@/types/sales.types` 引用无需改动。
 */

export * from './sales/common.types'
export * from './sales/quotation.types'
export * from './sales/cost-analysis.types'
export * from './sales/customer.types'
export * from './sales/order.types'
export * from './sales/shipment.types'
export * from './sales/sales-return.types'
export * from './sales/customs.types'
export * from './sales/material-price.types'
export * from './sales/bom-request.types'
export * from './sales/ecn.types'
export * from './sales/order-tracking.types'
export * from './sales/statement.types'
export * from './sales/order-change.types'
export * from './sales/analytics-report.types'
