/** contract-order 模块唯一对外出口（订单、备料领用、订单追踪）。 */

export { ContractOrderModule } from './contract-order.module'

/** 订单建单、审核链推进与备料领用 */
export {
  SalesOrderService,
  type OrderActor,
  type OrderContext,
  type SalesOrderDraftPayload,
} from './services/sales-order.service'
export { OrderReviewService } from './services/order-review.service'
export { StockConsumptionService, type ConsumeStockInput } from './services/stock-consumption.service'
export { OrderContextService } from './services/order-context.service'
export {
  OrderChangeRequestService,
  type SubmitOrderChangeInput,
} from './services/order-change-request.service'
export { OrderTrackingService, type TrackingEvent } from './services/order-tracking.service'
/** 出货过账后的订单状态回写：部分出货 → EXECUTING，全部发齐 → COMPLETED */
export { OrderFulfilmentService, nextOrderStatus } from './services/order-fulfilment.service'
/** 客户订单原件上传：带 orderId 即刻挂单，不带则暂存返回对象键 */
export {
  CustomerPoUploadService,
  composeCustomerPoObjectKey,
  type CustomerPoUploadInput,
  type CustomerPoUploadResult,
} from './services/customer-po-upload.service'

/** 订单修改申请的可改范围白名单：价格与下单产品锁定 */
export {
  ALLOWED_CHANGE_TYPES,
  CHANGE_TYPE_LABEL,
  REDIRECTED_INTENTS,
  isAllowedChangeType,
} from './constants/order-change-rules'

export { toOrderChangeView } from './services/order-change-view.mapper'
export { toLineTrackingView } from './services/order-tracking-view.mapper'
export type { OrderChangeRequestView } from './dto/order-change-view.dto'
export type { OrderLineTrackingView } from './dto/order-tracking-view.dto'
export type { TrackingNodeView } from './dto/tracking-node-view.dto'
export {
  ORDER_CHANGE_REQUEST_REPOSITORY,
  type CreateOrderChangeRequestData,
  type HandleOrderChangeData,
  type OrderChangeRequestRecord,
  type OrderChangeRequestRepositoryPort,
} from './repositories/order-change-request.repository.port'
export {
  ORDER_TRACKING_REPOSITORY,
  type OrderTrackingRepositoryPort,
  type TrackingNodeDraft,
  type TrackingNodeProgressPatch,
  type TrackingNodeRecord,
} from './repositories/order-tracking.repository.port'

/** 审核链：业务经理 → 财务 →（备料另加总经办）→ 跨部门评审 */
export {
  REVIEW_CHAIN,
  firstReviewStatus,
  isOrderEditable,
  isReviewStatus,
  nextReviewStatus,
  orderStateMachine,
  reviewChainOf,
  stateMachineOf,
  stockPrepStateMachine,
} from './constants/order-states'
export { REVIEW_PERMISSIONS, permissionForReview } from './constants/review-permissions'

export { toSalesOrderView } from './services/sales-order-view.mapper'
export { toSalesOrderDraft } from './services/sales-order-input.mapper'
export type { SalesOrderView } from './dto/sales-order-view.dto'
export type { SalesOrderLineView } from './dto/sales-order-line-view.dto'
export {
  SALES_ORDER_REPOSITORY,
  type CreateSalesOrderData,
  type SalesOrderHeaderDraft,
  type SalesOrderLineDraft,
  type SalesOrderLineRecord,
  type SalesOrderQuery,
  type SalesOrderRecord,
  type SalesOrderRepositoryPort,
  type SalesOrderStatusPatch,
  type StockPrepAvailability,
} from './repositories/sales-order.repository.port'
export {
  STOCK_CONSUMPTION_REPOSITORY,
  type CreateStockConsumptionData,
  type StockConsumptionRecord,
  type StockConsumptionRepositoryPort,
} from './repositories/stock-consumption.repository.port'

/** 下单强制校验链：缺报价/成本分析/工程资料时一次性列出全部缺失项 */
export {
  collectPrerequisiteIssues,
  type OrderFacts,
  type OrderLineFacts,
  type PrerequisiteIssue,
} from './services/order-prerequisites'

/** 四种订单类型的规则差异表；客户订单原件是否必传由 needsCustomerPo 判定 */
export {
  ORDER_TYPE_RULES,
  needsCustomerPo,
  ruleOf,
  type OrderTypeRule,
} from './constants/order-type-rules'

/** 备料领用与加权平均成本：优先消耗备料直到用完 */
export {
  blendStockCost,
  isStockExhausted,
  remainingAfter,
  type StockBlendInput,
  type StockBlendResult,
} from './services/stock-blend'

/** 订单追踪：按工艺路线裁剪节点链，进度一律「完成数/工单数」 */
export {
  STANDARD_TRACKING_ROUTE,
  SURFACE_TREATMENT_CODES,
  type TrackingRouteNode,
} from './constants/tracking-route'
export { trimTrackingRoute, type TrimmedRouteNode } from './services/tracking-route'
export {
  aggregateLineProgress,
  clampDone,
  summarizeOrderProgress,
  toNodeProgress,
  type NodeProgress,
  type OrderLineProgress,
  type TrackingNodeFacts,
} from './services/tracking-progress'
