/** sales-analytics 模块唯一对外出口（业务部经营分析，只读）。 */

export { SalesAnalyticsModule } from './sales-analytics.module'

/** 端点服务 */
export { AnalyticsOverviewService } from './services/analytics-overview.service'
export { AnalyticsReportService } from './services/analytics-report.service'
export { DailyOpsService, orderAmountMinor, orderQty, openOrdersAt, shipmentAmountMinor, shipmentQty } from './services/daily-ops.service'
export { WorkbenchService } from './services/workbench.service'

/** 分域聚合 */
export { QuoteAnalyticsService, ORDER_APPROVAL_SLA_HOURS } from './services/quote-analytics.service'
export { OrderAnalyticsService, earliestDueOf, isBacklog } from './services/order-analytics.service'
export {
  DeliveryAnalyticsService,
  deliveryDueIndex,
  shippedQtyIndex,
} from './services/delivery-analytics.service'
export {
  CustomerAnalyticsService,
  averageIntervalDays,
  frequencyChange,
} from './services/customer-analytics.service'
export { RmaAnalyticsService } from './services/rma-analytics.service'
export { SlaAnalyticsService, percentile } from './services/sla-analytics.service'

/** 聚合口径的纯函数——只做算术与分组，不含业务规则 */
export {
  averageOf,
  dateKeyOf,
  dateKeysBackFrom,
  daysBetween,
  groupBy,
  hoursBetween,
  monthKeyOf,
  rateOf,
  shareOf,
  sumBy,
  sumMinorBy,
  sumQuantity,
  toTenThousand,
  toYuan,
  topN,
  withinPeriod,
} from './services/analytics-aggregation.rules'

/** 字典与窗口 */
export {
  ANALYTICS_LIMITS,
  DAILY_OPS_CALIBER,
  DAILY_OPS_WINDOW_DAYS,
  RANK_LIMIT,
  TREND_WINDOW_MONTHS,
} from './constants/analytics-periods'
export {
  BACKLOG_BUCKETS,
  BACKLOG_WARN_DAYS,
  CHURN_THRESHOLDS,
  CUSTOMER_GRADE_THRESHOLDS,
  ORDER_TYPE_LABEL,
  RMA_RESPONSE_SLA_HOURS,
  backlogBucketOf,
  churnRiskOf,
  gradeOf,
  type BacklogBucket,
} from './constants/analytics-labels'

/** 四个上游域读端口（落地前为 STUB，返回空行集） */
export {
  COSTING_ANALYTICS_PORT,
  FINANCE_ANALYTICS_PORT,
  MES_ANALYTICS_PORT,
  WMS_ANALYTICS_PORT,
  type CostingAnalyticsPort,
  type FinanceAnalyticsPort,
  type MesAnalyticsPort,
  type WmsAnalyticsPort,
} from './repositories/upstream-source.ports'
