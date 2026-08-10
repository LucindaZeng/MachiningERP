/**
 * 敏感字段清单（业务规格 3.2：「客户档案变更（银行账号、付款条件等敏感字段）留痕并按权限审批」）。
 *
 * 命中这些字段的修改不会立即生效，而是生成一张变更申请，
 * 由持有 `customer.sensitive.edit` 的人审批通过后才落库。
 */
export const SENSITIVE_CUSTOMER_FIELDS = [
  'bankAccount',
  'bankName',
  'taxNo',
  'paymentTerm',
  'depositBps',
  'invoiceType',
  'settlement',
] as const

export type SensitiveCustomerField = (typeof SENSITIVE_CUSTOMER_FIELDS)[number]

const SENSITIVE_LABELS: Record<SensitiveCustomerField, string> = {
  bankAccount: '银行账号',
  bankName: '开户行',
  taxNo: '税号',
  paymentTerm: '付款条件',
  depositBps: '预付比例',
  invoiceType: '发票种类',
  settlement: '结算方式',
}

export function isSensitiveField(field: string): field is SensitiveCustomerField {
  return (SENSITIVE_CUSTOMER_FIELDS as readonly string[]).includes(field)
}

export function labelOfSensitiveField(field: SensitiveCustomerField): string {
  return SENSITIVE_LABELS[field]
}
