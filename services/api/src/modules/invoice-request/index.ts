/** invoice-request 模块唯一对外出口（发票申请，业务规格第 9 章）。 */

export { InvoiceRequestModule } from './invoice-request.module'

/** 状态机：DocStatus 词汇，寄出与签收不是状态而是时间戳事件 */
export {
  INVOICE_TRANSITIONS,
  invoiceStateMachine,
  isInvoiceEditable,
  isIssued,
  isVoidable,
} from './constants/invoice-states'
export {
  INVOICE_DELIVERY_NODES,
  INVOICE_TIMELINE_NODES,
  timelineNodeFor,
} from './constants/invoice-timeline'
export {
  DEFAULT_LIST_LIMIT,
  INVOICE_KIND_TO_WIRE,
  INVOICE_KIND_VALUES,
  INVOICE_STATUS_TO_WIRE,
  INVOICE_STATUS_VALUES,
  type InvoiceKindFilter,
  type InvoiceStatusFilter,
} from './constants/invoice-filters'

/** 自动带出：发票种类、税率、开票信息、账期 */
export {
  VAT_RATE_BPS,
  ZERO_RATE_BPS,
  autofillInvoice,
  lineTaxMinor,
  paymentTermDays,
  resolveInvoiceKind,
  taxRateBpsFor,
  type AutofilledInvoice,
  type AutofilledLine,
  type InvoiceCustomerFacts,
  type InvoiceLineFacts,
} from './services/invoice-autofill'

/** 三方金额一致性与红冲额度 */
export {
  checkAmountMatch,
  remainingCreditable,
  type AmountMatchInput,
  type AmountMatchResult,
} from './services/invoice-amount-match'

/** 主用例：建单（全自动带出）、开票执行、红冲 */
export {
  InvoiceRequestService,
  type CreateInvoiceInput,
  type InvoiceActor,
} from './services/invoice-request.service'
export { InvoiceIssuanceService, assertDeliveryOrder } from './services/invoice-issuance.service'
export { InvoiceCreditNoteService } from './services/invoice-credit-note.service'
export { InvoiceReadService } from './services/invoice-read.service'
export { InvoiceContextService } from './services/invoice-context.service'
/** 对账单「开票」列的真实来源，启动时注册进 shipment 的 registry */
export { InvoiceStatementSource } from './services/invoice-statement-source'

export { toInvoiceRequestView, type InvoiceNaming } from './services/invoice-view.mapper'
export type { InvoiceRequestView } from './dto/invoice-request-view.dto'
export type { InvoiceLineView } from './dto/invoice-line-view.dto'

export {
  INVOICE_REPOSITORY,
  type CreateInvoiceData,
  type InvoiceLineDraft,
  type InvoiceLineRecord,
  type InvoicePatch,
  type InvoiceQuery,
  type InvoiceRecord,
  type InvoiceRepositoryPort,
} from './repositories/invoice-request.repository.port'
export {
  FINANCE_ISSUANCE_PORT,
  type FinanceIssuancePort,
  type FinanceIssuanceRequest,
  type FinanceIssuanceResult,
} from './repositories/finance-issuance.port'
