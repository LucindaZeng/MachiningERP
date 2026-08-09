import type { Money } from '../money/money'

export type CustomerRegionCode = 'DOMESTIC' | 'OVERSEAS'
export type CustomerStatusCode = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'SUSPENDED'
export type PaymentTermCode =
  /** 预付一定比例、剩余出货前付清 */
  | 'DEPOSIT_THEN_BALANCE'
  /** 现金，出货前全部付完 */
  | 'CASH_BEFORE_SHIPMENT'
  | 'NET_30'
  | 'NET_60'
  | 'NET_90'
export type InvoiceTypeCode = 'GENERAL' | 'SPECIAL'
export type SettlementMethodCode = 'CASH' | 'NOTE'

export interface CustomerDeliveryAddressContract {
  id: string
  label: string
  receiver: string
  phone: string
  address: string
  isDefault: boolean
}

/** 香港 70% 价格分组。**无权限时整组缺席**，不是给假值。 */
export interface CustomerHkPricingContract {
  pricingEnabled: boolean
  /** 0.7 表示 70% */
  factor: number
  effectiveFrom: string | null
  appliedBy: string | null
  approvedBy: string | null
  changeReason: string | null
}

export interface CustomerFinanceContract {
  /** 无 `customer.finance.view` 权限时只给后 4 位 */
  taxNo: string | null
  bankAccount: string | null
  bankName: string | null
  creditLimit: Money
  creditUsed: Money
  overdueAmount: Money
  arDays: number
}

/**
 * 客户档案的对外表示，前后端共用同一份。
 * 后端 `modules/masterdata` 按权限裁剪后产出，前端直接消费。
 */
export interface CustomerContract {
  id: string
  code: string
  name: string
  shortName: string
  region: CustomerRegionCode
  country: string
  englishName: string | null
  englishAddress: string | null
  ownerName: string
  ownerPhone: string
  ownerEmail: string | null
  salesUserCode: string | null
  invoiceAddress: string
  paymentTerm: PaymentTermCode
  /** 0.3 表示 30%；仅付款条件①有值 */
  depositRatio: number | null
  invoiceType: InvoiceTypeCode
  settlement: SettlementMethodCode
  currency: string
  tradeTerm: string | null
  level: string | null
  status: CustomerStatusCode
  approvedBy: string | null
  addresses: CustomerDeliveryAddressContract[]
  finance: CustomerFinanceContract
  hk?: CustomerHkPricingContract
  createdBy: string | null
  updatedAt: string
  version: number
}

/** 下单前的档案完整性检查结果 */
export interface CustomerCompletenessContract {
  ready: boolean
  /** 缺失项的中文清单，直接用于下单拦截提示 */
  missing: string[]
}

export const PAYMENT_TERM_LABELS: Record<PaymentTermCode, string> = {
  DEPOSIT_THEN_BALANCE: '预付比例 + 出货前付清',
  CASH_BEFORE_SHIPMENT: '现金，出货前付清',
  NET_30: '票到 30 天',
  NET_60: '票到 60 天',
  NET_90: '票到 90 天',
}

export const INVOICE_TYPE_LABELS: Record<InvoiceTypeCode, string> = {
  GENERAL: '普票',
  SPECIAL: '专票',
}
