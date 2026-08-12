import { request } from '../http'

import type {
  CostReports,
  DailyOpsReport,
  MarketReports,
  OrderExtraReports,
  SalesAnalytics,
  SalesReports,
} from '@machining-erp/shared'

/** GET /sales/analytics —— 业务部经营分析看板（BI 指标口径见页面说明表） */
export function fetchSalesAnalytics(): Promise<SalesAnalytics> {
  return request<SalesAnalytics>({ method: 'GET', url: '/sales/analytics' })
}

/** GET /sales/reports —— 业务部六大类报表明细 */
export function fetchSalesReports(): Promise<SalesReports> {
  return request<SalesReports>({ method: 'GET', url: '/sales/reports' })
}

/** GET /sales/reports/cost-variance —— 报价成本偏差分析、成本参考值反馈与审核时效 */
export function fetchCostReports(): Promise<CostReports> {
  return request<CostReports>({ method: 'GET', url: '/sales/reports/cost-variance' })
}

/** GET /sales/reports/order-extra —— 五类订单结构、在手订单 Backlog、样品转化率与备料分析 */
export function fetchOrderExtraReports(): Promise<OrderExtraReports> {
  return request<OrderExtraReports>({ method: 'GET', url: '/sales/reports/order-extra' })
}

/** GET /sales/reports/market —— 客户流失预警、产品与材质工艺、出货达成与退货责任分析 */
export function fetchMarketReports(): Promise<MarketReports> {
  return request<MarketReports>({ method: 'GET', url: '/sales/reports/market' })
}

/** GET /sales/reports/daily-ops —— 每日接单量、出货量与未完成订单存量 */
export function fetchDailyOps(): Promise<DailyOpsReport> {
  return request<DailyOpsReport>({ method: 'GET', url: '/sales/reports/daily-ops' })
}
