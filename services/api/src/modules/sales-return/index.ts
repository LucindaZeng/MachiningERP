/** sales-return 模块唯一对外出口（客诉与退货 / RMA）。 */

export { SalesReturnModule } from './sales-return.module'

/** 主用例与节点推进 */
export {
  SalesReturnService,
  assertAmountsMutable,
  assertReturnableLines,
  type RegisterReturnInput,
  type ReturnActor,
} from './services/sales-return.service'
export {
  ReturnFlowService,
  assertClosable,
  assertDispositionsResolved,
  factsOf,
  pendingReceiptLines,
  type DispositionLineInput,
  type JudgeLineInput,
} from './services/return-flow.service'
export { ReturnReadService } from './services/return-read.service'
export {
  ReturnContextService,
  type ReturnShipmentContext,
  type ShippedLineFacts,
} from './services/return-context.service'

/** 逐行处置规则：结案闸门、单头派生值、财务升级判定 */
export {
  collectClosureIssues,
  isMixedDisposition,
  isMixedResponsibility,
  needsFinanceApproval,
  reworkLines,
  rollupDisposition,
  rollupResponsibility,
  type ClosureIssue,
  type ClosureIssueKind,
  type ReturnLineFacts,
} from './services/return-disposition.rules'

/** 对账扣减口径：哪些处置进对账单、算 RETURN 还是 ALLOWANCE、扣多少 */
export {
  deductionMinorOf,
  deductionTypeOf,
  totalDeductionOf,
  type ReturnDeductionFacts,
} from './services/return-statement.rules'
export { ReturnStatementSource } from './services/return-statement-source'

/** 状态机与字典 */
export {
  SALES_RETURN_TRANSITIONS,
  isReturnClosed,
  isReturnEditable,
  isReturnTerminal,
  salesReturnStateMachine,
} from './constants/return-states'
export {
  DISPOSITION_BY_WIRE,
  DISPOSITION_TO_WIRE,
  NEEDS_FINANCE_APPROVAL,
  REQUIRES_REASON,
  RESPONSIBILITY_BY_WIRE,
  RESPONSIBILITY_TO_WIRE,
  STATEMENT_EFFECT,
  isDispositionWire,
  isResponsibilityWire,
  requiresGoodsReceipt,
  statementLineTypeOf,
  type DispositionWire,
  type ResponsibilityWire,
} from './constants/return-dispositions'
export {
  RETURN_TIMELINE_NODES,
  returnTimelineNodeFor,
  type ReturnTimelineStage,
} from './constants/return-timeline'

/** 视图映射 */
export { toSalesReturnView, type ReturnNaming } from './services/return-view.mapper'
export { toReturnTimelineView } from './services/return-timeline.mapper'
export type { SalesReturnView } from './dto/sales-return-view.dto'
export type { SalesReturnLineView } from './dto/sales-return-line-view.dto'

/** 仓储端口与财务执行 STUB 端口 */
export {
  SALES_RETURN_REPOSITORY,
  type CreateSalesReturnData,
  type SalesReturnLineDraft,
  type SalesReturnLinePatch,
  type SalesReturnLineRecord,
  type SalesReturnPatch,
  type SalesReturnQuery,
  type SalesReturnRecord,
  type SalesReturnRepositoryPort,
} from './repositories/sales-return.repository.port'
export {
  RETURN_SETTLEMENT_PORT,
  type ReturnSettlementLine,
  type ReturnSettlementPort,
  type ReturnSettlementRequest,
  type ReturnSettlementResult,
} from './repositories/return-settlement.port'
