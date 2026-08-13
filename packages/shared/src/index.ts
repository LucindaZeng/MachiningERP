/** @machining-erp/shared —— 前后端共享契约的唯一出口。 */

export * from './baseline'

export * from './money/currency'
export * from './money/money'
export * from './money/money-codec'
export * from './money/money-math'
export * from './money/rounding'

export * from './decimal/parse-decimal'

export * from './files/file-extensions'

export * from './quantity/quantity'

export * from './errors/error-segment'
export * from './errors/auth-error-codes'
export * from './errors/customer-error-codes'
export * from './errors/customs-error-codes'
export * from './errors/docgen-error-codes'
export * from './errors/ecn-error-codes'
export * from './errors/file-preview-error-codes'
export * from './errors/upload-error-codes'
export * from './errors/bom-error-codes'
export * from './errors/invoice-error-codes'
export * from './errors/order-error-codes'
export * from './errors/quotation-error-codes'
export * from './errors/sales-return-error-codes'
export * from './errors/shipment-error-codes'
export * from './errors/system-error-codes'

export * from './http/api-envelope'
export * from './http/pagination'

export * from './auth/login-audience'
export * from './auth/login-contracts'
export * from './auth/account-contracts'
export * from './auth/password-reset-contracts'

export * from './masterdata/customer-contracts'

export * from './analytics/panel-availability'
export * from './analytics/sales-analytics'
export * from './analytics/sales-reports'
export * from './analytics/cost-reports'
export * from './analytics/order-reports'
export * from './analytics/market-reports'
export * from './analytics/daily-ops'
export * from './analytics/sales-workbench'

export * from './permissions/permission-codes'
