import type { CustomerRegion, CustomerStatus, InvoiceType, PaymentTerm } from '@prisma/client'

/**
 * 下单前的客户档案完整性（业务规格 3.2）：
 * 「新客户在报价阶段只留公司名、联系人、联系方式；**成交下单前必须补全完整档案**方可建立订单。」
 *
 * 本文件是纯函数：contract-order 模块下单校验时直接调用，
 * 缺失项以可读清单返回，满足「系统提示报错并禁止下单，明确列出缺失项」。
 */
export interface CustomerCompletenessSnapshot {
  status: CustomerStatus
  region: CustomerRegion
  taxNo: string | null
  invoiceAddress: string | null
  bankAccount: string | null
  paymentTerm: PaymentTerm | null
  invoiceType: InvoiceType | null
  salesUserCode: string | null
  deliveryAddressCount: number
  hasDefaultDeliveryAddress: boolean
}

export interface CompletenessResult {
  ready: boolean
  /** 缺失项的中文清单，直接用于下单拦截提示 */
  missing: string[]
}

const REQUIRED_TEXT_FIELDS: ReadonlyArray<{
  key: keyof Pick<CustomerCompletenessSnapshot, 'invoiceAddress' | 'bankAccount' | 'salesUserCode'>
  label: string
}> = [
  { key: 'invoiceAddress', label: '发票地址' },
  { key: 'bankAccount', label: '银行账号' },
  { key: 'salesUserCode', label: '负责对接的业务人员' },
]

export function checkCustomerCompleteness(
  snapshot: CustomerCompletenessSnapshot,
): CompletenessResult {
  const missing: string[] = []

  if (snapshot.status !== 'ACTIVE') {
    missing.push(
      snapshot.status === 'DRAFT'
        ? '客户档案仍是报价阶段的临时档案，尚未补全并生效'
        : `客户档案状态为「${snapshot.status}」，只有生效（ACTIVE）客户才能下单`,
    )
  }

  for (const field of REQUIRED_TEXT_FIELDS) {
    if (!snapshot[field.key]?.trim()) missing.push(field.label)
  }

  if (snapshot.region === 'DOMESTIC' && !snapshot.taxNo?.trim()) {
    missing.push('税号（国内客户必填）')
  }
  if (!snapshot.paymentTerm) missing.push('付款条件')
  if (!snapshot.invoiceType) missing.push('发票种类')

  if (snapshot.deliveryAddressCount === 0) {
    missing.push('送货地址（至少 1 个）')
  } else if (!snapshot.hasDefaultDeliveryAddress) {
    missing.push('默认送货地址')
  }

  return { ready: missing.length === 0, missing }
}
