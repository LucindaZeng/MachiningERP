import type { InvoiceDocKind, InvoiceKind, InvoiceRequestStatus } from '@prisma/client'

export interface InvoiceLineRecord {
  id: string
  sequence: number
  shipmentId: string | null
  shipmentNo: string
  productName: string
  drawingNo: string
  quantity: string
  unitPriceMinor: bigint
  amountMinor: bigint
  taxRateBps: number
  taxAmountMinor: bigint
}

export interface InvoiceRecord {
  id: string
  docNo: string
  kind: InvoiceDocKind
  originalId: string | null
  customerId: string
  invoiceKind: InvoiceKind
  statementId: string | null
  currency: string
  amountExTaxMinor: bigint
  taxAmountMinor: bigint
  amountIncTaxMinor: bigint
  title: string
  taxNo: string
  bankAccount: string | null
  address: string | null
  deliveryMethod: string
  deliveryTarget: string
  amountMatched: boolean
  matchNote: string | null
  expectedPaymentDate: Date | null
  status: InvoiceRequestStatus
  ownerUserCode: string
  submittedAt: Date | null
  invoiceNo: string | null
  issuedAt: Date | null
  sentAt: Date | null
  signedAt: Date | null
  reasonText: string | null
  lines: InvoiceLineRecord[]
  versionLock: number
}

export type InvoiceLineDraft = Omit<InvoiceLineRecord, 'id'>

export interface CreateInvoiceData {
  docNo: string
  kind: InvoiceDocKind
  originalId: string | null
  customerId: string
  invoiceKind: InvoiceKind
  statementId: string | null
  currency: string
  amountExTaxMinor: bigint
  taxAmountMinor: bigint
  amountIncTaxMinor: bigint
  title: string
  taxNo: string
  bankAccount: string | null
  address: string | null
  deliveryMethod: string
  deliveryTarget: string
  amountMatched: boolean
  matchNote: string | null
  expectedPaymentDate: Date | null
  ownerUserCode: string
  reasonText: string | null
  createdBy: string
  lines: InvoiceLineDraft[]
}

export interface InvoicePatch {
  status?: InvoiceRequestStatus
  submittedAt?: Date | null
  invoiceNo?: string | null
  issuedAt?: Date | null
  sentAt?: Date | null
  signedAt?: Date | null
  reasonText?: string | null
  amountMatched?: boolean
  matchNote?: string | null
  updatedBy: string
}

export interface InvoiceQuery {
  customerId?: string
  status?: InvoiceRequestStatus
  invoiceKind?: InvoiceKind
  kind?: InvoiceDocKind
  /** 已开票时间区间，供对账单按期间取数 */
  issuedFrom?: Date
  issuedTo?: Date
  limit: number
}

export interface InvoiceRepositoryPort {
  findById(id: string): Promise<InvoiceRecord | null>
  list(query: InvoiceQuery): Promise<InvoiceRecord[]>
  create(data: CreateInvoiceData): Promise<InvoiceRecord>
  /** 带乐观锁的状态推进；版本冲突返回 null */
  patch(id: string, versionLock: number, patch: InvoicePatch): Promise<InvoiceRecord | null>
  /** 某张正票已经被红冲掉的累计金额（只算已开出的红字发票） */
  creditedAmountOf(originalId: string): Promise<bigint>
}

export const INVOICE_REPOSITORY = Symbol('INVOICE_REPOSITORY')
