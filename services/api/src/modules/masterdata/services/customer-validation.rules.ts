import type { CustomerRegion, InvoiceType, PaymentTerm, SettlementMethod } from '@prisma/client'

export const MAX_DELIVERY_ADDRESSES = 5
export const BPS_SCALE = 10_000

export interface DeliveryAddressInput {
  label: string
  receiver: string
  phone: string
  address: string
  isDefault: boolean
}

export interface CustomerProfileInput {
  name: string
  shortName: string
  region: CustomerRegion
  country: string
  ownerName: string
  ownerPhone: string
  taxNo?: string | null
  invoiceAddress: string
  bankAccount?: string | null
  paymentTerm: PaymentTerm
  depositBps?: number | null
  invoiceType: InvoiceType
  settlement: SettlementMethod
  addresses: DeliveryAddressInput[]
  hkPricingEnabled?: boolean
  hkFactorBps?: number | null
  hkEffectiveFrom?: string | null
  hkChangeReason?: string | null
}

export interface ValidationIssue {
  field: string
  message: string
}

function requireText(
  issues: ValidationIssue[],
  field: string,
  value: string | null | undefined,
  label: string,
): void {
  if (!value || !value.trim()) {
    issues.push({ field, message: `${label}为必填项` })
  }
}

/** 国内客户必填税号（业务规格 3.1）。国外客户走报关资料口径，不强制。 */
function checkTaxNo(issues: ValidationIssue[], input: CustomerProfileInput): void {
  if (input.region === 'DOMESTIC' && !input.taxNo?.trim()) {
    issues.push({ field: 'taxNo', message: '国内客户必须填写税号' })
  }
}

/** 付款条件①「预付一定比例、剩余出货前付清」必须给出预付比例。 */
function checkPaymentTerm(issues: ValidationIssue[], input: CustomerProfileInput): void {
  if (input.paymentTerm !== 'DEPOSIT_THEN_BALANCE') {
    if (input.depositBps != null) {
      issues.push({ field: 'depositBps', message: '只有「预付比例 + 出货前付清」才需要填预付比例' })
    }
    return
  }

  const bps = input.depositBps
  if (bps == null) {
    issues.push({ field: 'depositBps', message: '选择「预付比例 + 出货前付清」时必须填写预付比例' })
    return
  }
  if (!Number.isInteger(bps) || bps <= 0 || bps >= BPS_SCALE) {
    issues.push({ field: 'depositBps', message: '预付比例必须在 0% 与 100% 之间（不含两端）' })
  }
}

/** 送货地址最多 5 个，且有地址时必须**恰好一个**默认（业务规格 3.1）。 */
function checkAddresses(issues: ValidationIssue[], addresses: DeliveryAddressInput[]): void {
  if (addresses.length > MAX_DELIVERY_ADDRESSES) {
    issues.push({
      field: 'addresses',
      message: `送货地址最多 ${MAX_DELIVERY_ADDRESSES} 个，当前 ${addresses.length} 个`,
    })
  }

  addresses.forEach((address, index) => {
    requireText(issues, `addresses[${index}].receiver`, address.receiver, `第 ${index + 1} 个送货地址的收货人`)
    requireText(issues, `addresses[${index}].address`, address.address, `第 ${index + 1} 个送货地址的详细地址`)
  })

  if (addresses.length === 0) return

  const defaults = addresses.filter((address) => address.isDefault).length
  if (defaults !== 1) {
    issues.push({
      field: 'addresses',
      message: defaults === 0 ? '送货地址必须指定一个默认地址' : '只能有一个默认送货地址',
    })
  }
}

/** 勾选香港 70% 价格时必须同时给出生效日期与变更理由，便于审计追责。 */
function checkHkPricing(issues: ValidationIssue[], input: CustomerProfileInput): void {
  if (!input.hkPricingEnabled) return

  const factor = input.hkFactorBps
  if (factor == null || !Number.isInteger(factor) || factor <= 0 || factor > BPS_SCALE) {
    issues.push({ field: 'hkFactorBps', message: '香港价格系数必须在 0% 与 100% 之间' })
  }
  requireText(issues, 'hkEffectiveFrom', input.hkEffectiveFrom, '香港价格生效日期')
  requireText(issues, 'hkChangeReason', input.hkChangeReason, '香港价格变更理由')
}

/** 客户档案的完整校验。返回全部问题而不是遇错即停，界面可一次性提示。 */
export function validateCustomerProfile(input: CustomerProfileInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  requireText(issues, 'name', input.name, '客户名称')
  requireText(issues, 'shortName', input.shortName, '客户简称')
  requireText(issues, 'country', input.country, '国家/地区')
  requireText(issues, 'ownerName', input.ownerName, '负责人')
  requireText(issues, 'ownerPhone', input.ownerPhone, '负责人电话')
  requireText(issues, 'invoiceAddress', input.invoiceAddress, '发票地址')

  checkTaxNo(issues, input)
  checkPaymentTerm(issues, input)
  checkAddresses(issues, input.addresses)
  checkHkPricing(issues, input)

  return issues
}
