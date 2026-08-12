/**
 * 业务部六大类报表明细（规格第 11 章）。
 *
 * 前后端共享的线上契约（development-guide §1）。后端 DTO 映射器与前端面板
 * 编译同一份定义，字段漂移因此是编译错误而不是线上惊喜。
 */

import type { PanelAvailability } from './panel-availability'

export interface FunnelRow {
  stage: string
  count: number
  hint: string
}

export interface QuoteByDim {
  name: string
  quoted: number
  won: number
  rate: number
  avgMargin: number
}

export interface LostReason {
  reason: string
  count: number
  amount: number
}

export interface QuoteCycleRow {
  docNo: string
  customer: string
  costingHours: number
  approvalHours: number
  totalHours: number
  slaHours: number
  overdue: boolean
}

export interface CostVarianceRow {
  productName: string
  drawingNo: string
  quotedCost: string
  actualCost: string
  gapRate: number
  mainReason: string
}

export interface BacklogRow {
  bucket: string
  orders: number
  amount: number
  hint: string
}

export interface OrderMixRow {
  type: string
  count: number
  amount: number
  share: number
}

export interface OrderTrendRow {
  month: string
  amount: number
  count: number
  yoy: number
  mom: number
}

export interface OnTimeRow {
  customer: string
  total: number
  late: number
  rate: number
}

export interface LateReason {
  reason: string
  count: number
  share: number
}

export interface CustomerRankRow {
  customer: string
  amount: number
  share: number
  cumShare: number
  grade: 'A' | 'B' | 'C'
}

export interface CustomerMarginRow {
  customer: string
  amount: number
  margin: number
  target: number
}

export interface CustomerActivityRow {
  customer: string
  lastOrderAt: string
  daysSince: number
  freqChange: number
  risk: 'normal' | 'watch' | 'churn'
}

export interface NewCustomerRow {
  customer: string
  firstOrderAt: string
  firstAmount: number
  source: string
}

export interface ArAgingRow {
  customer: string
  notDue: number
  d1to30: number
  d31to60: number
  d61to90: number
  over90: number
}

export interface ProductMarginRow {
  productName: string
  drawingNo: string
  amount: number
  margin: number
  quotedMargin: number
}

export interface MixRow {
  name: string
  value: number
  share: number
  trend: string
}

export interface PriceTrendRow {
  productName: string
  drawingNo: string
  history: Array<{ date: string; price: number }>
  materialChange: number
  suggestion: string
}

export interface ShipmentAchieveRow {
  month: string
  planned: number
  actual: number
  rate: number
}

export interface InvoiceReceivableRow {
  docNo: string
  customer: string
  shippedAt: string
  amount: number
  invoiced: boolean
  received: boolean
  ageDays: number
}

export interface RmaStatRow {
  reason: string
  batches: number
  quantity: number
  amount: number
  share: number
}

export interface RepeatIssueRow {
  customer: string
  productName: string
  times: number
  lastAt: string
  status: string
}

export interface SalesReports extends PanelAvailability {
  quoteFunnel: FunnelRow[]
  quoteByOwner: QuoteByDim[]
  quoteByMaterial: QuoteByDim[]
  lostReasons: LostReason[]
  quoteCycle: QuoteCycleRow[]
  costVariance: CostVarianceRow[]
  backlog: BacklogRow[]
  orderMix: OrderMixRow[]
  sampleConversion: { samples: number; converted: number; rate: number; amount: number }
  orderTrend: OrderTrendRow[]
  onTime: OnTimeRow[]
  lateReasons: LateReason[]
  customerRank: CustomerRankRow[]
  customerMargin: CustomerMarginRow[]
  customerActivity: CustomerActivityRow[]
  newCustomers: NewCustomerRow[]
  arAging: ArAgingRow[]
  productMargin: ProductMarginRow[]
  materialMix: MixRow[]
  processMix: MixRow[]
  priceTrend: PriceTrendRow[]
  shipmentAchieve: ShipmentAchieveRow[]
  invoiceReceivable: InvoiceReceivableRow[]
  rmaStats: RmaStatRow[]
  repeatIssues: RepeatIssueRow[]
}
