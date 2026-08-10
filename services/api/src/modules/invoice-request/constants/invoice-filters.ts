import type { InvoiceKind, InvoiceRequestStatus } from '@prisma/client'

/** 列表过滤的枚举字面量，放 constants/ 好让 DTO 不必 import @prisma/client。 */
export const INVOICE_STATUS_VALUES = [
  'DRAFT',
  'SUBMITTED',
  'REVIEWING',
  'COMPLETED',
  'REJECTED',
  'VOID',
] as const satisfies readonly InvoiceRequestStatus[]

export type InvoiceStatusFilter = (typeof INVOICE_STATUS_VALUES)[number]

export const INVOICE_KIND_VALUES = [
  'SPECIAL',
  'GENERAL',
  'EXPORT',
  'PROFORMA',
] as const satisfies readonly InvoiceKind[]

export type InvoiceKindFilter = (typeof INVOICE_KIND_VALUES)[number]

export const DEFAULT_LIST_LIMIT = 200

/** 前端小写枚举 ↔ 库里大写枚举，映射只此一处。 */
export const INVOICE_KIND_TO_WIRE: Record<InvoiceKind, string> = {
  SPECIAL: 'special',
  GENERAL: 'general',
  EXPORT: 'export',
  PROFORMA: 'proforma',
}

export const INVOICE_STATUS_TO_WIRE: Record<InvoiceRequestStatus, string> = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  REVIEWING: 'reviewing',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  VOID: 'void',
}
