/** shipment 模块唯一对外出口（出货管理 + 客户对账单）。 */

export { ShipmentModule } from './shipment.module'

/** 出货主用例与节点推进 */
export { ShipmentService, assertShippableLines, type ShipmentActor } from './services/shipment.service'
export { ShipmentFlowService } from './services/shipment-flow.service'
export { ShipmentReadService } from './services/shipment-read.service'
export { ShipmentTailService, buildResolutions } from './services/shipment-tail.service'
export {
  ShipmentContextService,
  type OrderLineFacts,
  type ShipmentCustomerContext,
  type ShipmentOrderContext,
} from './services/shipment-context.service'
export {
  ShipmentPostingService,
  buildPostedLines,
  type PostedLinePayload,
} from './services/shipment-posting.service'

/** 出货双闸门：品质放行 + 财务信用 */
export { ShipGateService } from './services/ship-gate.service'
export {
  collectCreditIssues,
  collectQcIssues,
  collectShipGateIssues,
  needsPrepayment,
  paymentTermLabel,
  type CreditFacts,
  type QcLineFacts,
  type ShipGateIssue,
  type ShipGateName,
} from './services/ship-gate.rules'

/** 尾数四路径与结案数量平衡校验 */
export {
  collectTailImbalances,
  hasOutstandingTail,
  outstandingTailOf,
  tailQtyOf,
  totalTailQty,
  type TailImbalance,
  type TailLineFacts,
} from './services/tail-balance.rules'
export {
  TAIL_PLAN_BY_WIRE,
  TAIL_PLAN_LABEL,
  TAIL_PLAN_TO_WIRE,
  isTailPlanWire,
  type TailPlanWire,
} from './constants/tail-plans'

/** 状态机与节点定义 */
export {
  SHIPMENT_TRANSITIONS,
  hasLeftFactory,
  isShipmentEditable,
  shipmentStateMachine,
} from './constants/shipment-states'
export {
  SHIPMENT_TIMELINE_NODES,
  timelineNodeFor,
  type ShipmentTimelineStage,
} from './constants/shipment-timeline'
export {
  STATEMENT_TRANSITIONS,
  isStatementMutable,
  statementStateMachine,
} from './constants/statement-states'

/** 客户对账单 */
export { StatementService, assertDifferenceExplained, type GenerateStatementInput } from './services/statement.service'
export { StatementReadService } from './services/statement-read.service'
export { StatementSourceService } from './services/statement-source.service'
/** 对账单来源注册表：下游模块（发票、退货）落地后把自己塞进来，方向单一不成环 */
export {
  StatementSourceRegistry,
  type ReturnSourceEntry,
  type StatementInvoiceSource,
  type StatementReturnSource,
} from './services/statement-source.registry'
export {
  aggregateStatement,
  countsTowardReturns,
  orderEntries,
  signedAmountOf,
  type AggregationEntry,
  type AggregationInput,
  type AggregationTotals,
  type StatementBasis,
} from './services/statement-aggregation'

/** 视图映射 */
export { toShipmentView, lineAmountMinor, type ShipmentNaming } from './services/shipment-view.mapper'
export { toShipmentTimelineView } from './services/shipment-timeline.mapper'
export {
  toStatementView,
  STATEMENT_LINE_TYPE_LABEL,
  type StatementNaming,
} from './services/statement-view.mapper'
export type { ShipmentView } from './dto/shipment-view.dto'
export type { ShipmentLineView } from './dto/shipment-line-view.dto'
export type { StatementView } from './dto/statement-view.dto'
export type { StatementLineView } from './dto/statement-line-view.dto'
export type { TailPlanResultView } from './dto/tail-plan-result.dto'
/** 节点计时的通用对外形状，发票等模块的时间线复用同一支映射 */
export type { DocTimelineNodeView } from './dto/doc-timeline-node-view.dto'

/** 仓储端口与读端口（含三个待替换的 STUB） */
export {
  SHIPMENT_REPOSITORY,
  type CreateShipmentData,
  type ShipmentHeaderDraft,
  type ShipmentLineDraft,
  type ShipmentLineRecord,
  type ShipmentPatch,
  type ShipmentQuery,
  type ShipmentRecord,
  type ShipmentRepositoryPort,
  type TailResolution,
} from './repositories/shipment.repository.port'
export {
  STATEMENT_REPOSITORY,
  type CreateStatementData,
  type StatementLineDraft,
  type StatementLineRecord,
  type StatementPatch,
  type StatementQuery,
  type StatementRecord,
  type StatementRepositoryPort,
} from './repositories/statement.repository.port'
export {
  QC_RELEASE_PORT,
  type QcReleasePort,
  type QcReleaseQuery,
  type QcReleaseVerdict,
} from './repositories/qc-release.port'
export {
  RECEIPT_PORT,
  type ReceiptEntry,
  type ReceiptPort,
  type ReceiptSummary,
} from './repositories/receipt.port'
export {
  STATEMENT_SOURCE_PORT,
  type SourceDocumentEntry,
  type StatementSourcePort,
} from './repositories/statement-source.port'
