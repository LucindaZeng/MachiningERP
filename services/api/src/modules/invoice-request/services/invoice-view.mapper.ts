import { fromMinor, type CurrencyCode } from '@machining-erp/shared'

import { INVOICE_KIND_TO_WIRE, INVOICE_STATUS_TO_WIRE } from '../constants/invoice-filters'

import type { DocTimelineNodeView } from '../../shipment'
import type { InvoiceLineView } from '../dto/invoice-line-view.dto'
import type { InvoiceRequestView } from '../dto/invoice-request-view.dto'
import type {
  InvoiceLineRecord,
  InvoiceRecord,
} from '../repositories/invoice-request.repository.port'

const BPS_SCALE = 10_000

/** 客户抬头与关联对账单号在别的模块里，由调用方查好传进来。 */
export interface InvoiceNaming {
  customerName: string
  customerCode: string
  statementNo: string | null
  ownerName: string
  originalDocNo: string | null
}

function toLineView(line: InvoiceLineRecord, currency: CurrencyCode): InvoiceLineView {
  return {
    seq: line.sequence,
    shipmentNo: line.shipmentNo,
    productName: line.productName,
    drawingNo: line.drawingNo,
    quantity: line.quantity,
    unitPrice: fromMinor({ minor: line.unitPriceMinor, currency }).amount,
    amount: fromMinor({ minor: line.amountMinor, currency }).amount,
    taxRate: line.taxRateBps / BPS_SCALE,
    taxAmount: fromMinor({ minor: line.taxAmountMinor, currency }).amount,
  }
}

/**
 * 对外形状逐字对齐前端 `InvoiceRequest`。
 * 红字发票就是一行普通记录：金额为负 + `originalDocNo` 指着原票，列表不用改。
 */
export function toInvoiceRequestView(
  record: InvoiceRecord,
  naming: InvoiceNaming,
  timeline: DocTimelineNodeView[],
): InvoiceRequestView {
  const currency = record.currency as CurrencyCode
  const money = (minor: bigint): string => fromMinor({ minor, currency }).amount

  const view: InvoiceRequestView = {
    id: record.id,
    docNo: record.docNo,
    customerName: naming.customerName,
    customerCode: naming.customerCode,
    invoiceType: INVOICE_KIND_TO_WIRE[record.invoiceKind] as InvoiceRequestView['invoiceType'],
    lines: record.lines.map((line) => toLineView(line, currency)),
    amountExTax: money(record.amountExTaxMinor),
    taxAmount: money(record.taxAmountMinor),
    amountIncTax: money(record.amountIncTaxMinor),
    currency: record.currency,
    title: record.title,
    taxNo: record.taxNo,
    deliveryMethod: record.deliveryMethod as InvoiceRequestView['deliveryMethod'],
    deliveryTarget: record.deliveryTarget,
    amountMatched: record.amountMatched,
    expectedPaymentDate: record.expectedPaymentDate?.toISOString().slice(0, 10) ?? '',
    status: INVOICE_STATUS_TO_WIRE[record.status] as InvoiceRequestView['status'],
    owner: naming.ownerName,
    submittedAt: record.submittedAt?.toISOString() ?? '',
    timeline,
    kind: record.kind === 'CREDIT_NOTE' ? 'credit-note' : 'invoice',
    versionLock: record.versionLock,
  }

  if (naming.statementNo) view.statementNo = naming.statementNo
  if (record.bankAccount) view.bankAccount = record.bankAccount
  if (record.address) view.address = record.address
  if (record.invoiceNo) view.invoiceNo = record.invoiceNo
  if (record.issuedAt) view.issuedAt = record.issuedAt.toISOString()
  if (record.matchNote) view.matchNote = record.matchNote
  if (naming.originalDocNo) view.originalDocNo = naming.originalDocNo
  if (record.reasonText) view.voidReason = record.reasonText

  return view
}
