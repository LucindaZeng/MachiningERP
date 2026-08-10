import type { InvoiceLineView } from './invoice-line-view.dto'
import type { DocTimelineNodeView } from '../../shipment'

/**
 * 发票申请对外形状，逐字对齐前端 `InvoiceRequest`，
 * 另加三个**可选**字段（kind / originalDocNo / voidReason）供红冲与作废使用——
 * 可选即前端不改也能编译，红字单在既有列表里就是一行负数记录。
 */
export interface InvoiceRequestView {
  id: string
  docNo: string
  customerName: string
  customerCode: string
  invoiceType: 'special' | 'general' | 'export' | 'proforma'
  statementNo?: string
  lines: InvoiceLineView[]
  amountExTax: string
  taxAmount: string
  amountIncTax: string
  currency: string
  title: string
  taxNo: string
  bankAccount?: string
  address?: string
  deliveryMethod: '电子发票（邮箱）' | '纸质发票（快递）'
  deliveryTarget: string
  invoiceNo?: string
  issuedAt?: string
  amountMatched: boolean
  matchNote?: string
  expectedPaymentDate: string
  status: 'draft' | 'submitted' | 'reviewing' | 'approved' | 'executing' | 'completed' | 'closed' | 'rejected' | 'void'
  owner: string
  submittedAt: string
  timeline: DocTimelineNodeView[]
  /** 正票还是红字发票 */
  kind?: 'invoice' | 'credit-note'
  /** 红字发票指向的原票号 */
  originalDocNo?: string
  /** 作废或红冲的理由 */
  voidReason?: string
  versionLock: number
}
