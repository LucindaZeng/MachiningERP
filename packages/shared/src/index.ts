/** @machining-erp/shared —— 前后端共享契约的唯一出口。 */

export * from './money/currency'
export * from './money/money'
export * from './money/money-codec'
export * from './money/money-math'
export * from './money/rounding'

export * from './decimal/parse-decimal'

export * from './quantity/quantity'

export * from './errors/error-segment'
export * from './errors/auth-error-codes'
export * from './errors/customer-error-codes'
export * from './errors/quotation-error-codes'
export * from './errors/system-error-codes'

export * from './http/api-envelope'
export * from './http/pagination'

export * from './auth/login-audience'
export * from './auth/login-contracts'
export * from './auth/account-contracts'
export * from './auth/password-reset-contracts'

export * from './masterdata/customer-contracts'

export * from './permissions/permission-codes'
