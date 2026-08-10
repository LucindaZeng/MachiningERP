import type {
  CustomerRegion,
  CustomerStatus,
  InvoiceType,
  PaymentTerm,
  SettlementMethod,
} from '@prisma/client'

export interface DeliveryAddressRecord {
  id: string
  label: string
  receiver: string
  phone: string
  address: string
  isDefault: boolean
  sortOrder: number
}

/** 尚未落库的送货地址（没有 id），建档与改档都用这个形状 */
export type DeliveryAddressDraft = Omit<DeliveryAddressRecord, 'id'>

export interface CustomerRecord {
  id: string
  code: string
  name: string
  shortName: string
  region: CustomerRegion
  country: string
  englishName: string | null
  englishAddress: string | null
  ownerName: string
  ownerPhone: string
  ownerEmail: string | null
  salesUserCode: string | null
  taxNo: string | null
  invoiceAddress: string
  bankAccount: string | null
  bankName: string | null
  paymentTerm: PaymentTerm
  depositBps: number | null
  invoiceType: InvoiceType
  settlement: SettlementMethod
  currency: string
  tradeTerm: string | null
  level: string | null
  status: CustomerStatus
  approvedBy: string | null
  creditLimitMinor: bigint
  creditUsedMinor: bigint
  overdueAmountMinor: bigint
  arDays: number
  addresses: DeliveryAddressRecord[]
  createdBy: string | null
  updatedAt: Date
  version: number
}

export interface CustomerListFilter {
  q?: string
  status?: CustomerStatus
  region?: CustomerRegion
  /** 数据权限：给定时只返回该业务员负责的客户 */
  salesUserCode?: string
  page: number
  pageSize: number
}

export interface CustomerListResult {
  items: CustomerRecord[]
  total: number
}

export interface CreateCustomerData {
  code: string
  name: string
  shortName: string
  region: CustomerRegion
  country: string
  englishName: string | null
  englishAddress: string | null
  ownerName: string
  ownerPhone: string
  ownerEmail: string | null
  salesUserCode: string | null
  taxNo: string | null
  invoiceAddress: string
  bankAccount: string | null
  bankName: string | null
  paymentTerm: PaymentTerm
  depositBps: number | null
  invoiceType: InvoiceType
  settlement: SettlementMethod
  currency: string
  tradeTerm: string | null
  level: string | null
  status: CustomerStatus
  createdBy: string
  addresses: DeliveryAddressDraft[]
}

export interface UpdateCustomerData {
  id: string
  version: number
  updatedBy: string
  patch: Record<string, string | number | boolean | null>
  /** 传入时整体替换送货地址；不传表示本次不动地址 */
  addresses?: DeliveryAddressDraft[]
}

export interface CustomerRepositoryPort {
  findById(id: string): Promise<CustomerRecord | null>
  findByCode(code: string): Promise<CustomerRecord | null>
  existsByName(name: string): Promise<boolean>
  list(filter: CustomerListFilter): Promise<CustomerListResult>
  create(data: CreateCustomerData): Promise<CustomerRecord>
  /** 带乐观锁的更新；版本冲突返回 null */
  update(data: UpdateCustomerData): Promise<CustomerRecord | null>
}

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY')
