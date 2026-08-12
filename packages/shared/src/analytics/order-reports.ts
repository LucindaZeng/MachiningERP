/**
 * 五类订单结构、在手订单 Backlog、样品与备料
 *
 * 这些是**前后端共享的线上契约**（development-guide §1：packages/shared = 类型/DTO/枚举/错误码）。
 * 后端 DTO 映射器与前端面板编译同一份定义，字段漂移因此是编译错误而不是线上惊喜。
 * fixture 只保留数据，类型从这里反向引入。
 */

import type { PanelAvailability } from './panel-availability'

export interface OrderType5Row {
  type: string
  count: number
  quantity: number
  amount: number
  share: number
  marginRate: number | null
  note: string
}

export interface BacklogMonthRow {
  month: string
  orders: number
  quantity: number
  amount: number
  capacityLoad: number
  risk: 'ok' | 'tight' | 'over'
}

export interface BacklogDimRow {
  name: string
  orders: number
  amount: number
  share: number
  nearestDue: string
}

export interface BacklogAlertRow {
  orderNo: string
  customer: string
  productName: string
  dueDate: string
  daysLeft: number
  stage: string
  level: 'due' | 'late'
  owner: string
  action: string
}

export interface SampleCycleRow {
  month: string
  samples: number
  converted: number
  rate: number
  avgDays: number
}

export interface SampleChargeRow {
  mode: '免费样品' | '收费样品'
  samples: number
  converted: number
  rate: number
  avgAmount: number
  note: string
}

export interface SamplePendingRow {
  docNo: string
  customer: string
  productName: string
  sampleAt: string
  daysSince: number
  charged: boolean
  lastFollow: string
  suggestion: string
}

export interface StockProgressRow {
  docNo: string
  productName: string
  drawingNo: string
  planQty: number
  finishedQty: number
  stockedQty: number
  rate: number
  eta: string
  status: '生产中' | '已入库' | '已耗尽'
}

export interface StockAgingRow {
  bucket: string
  batches: number
  quantity: number
  amount: number
  share: number
}

export interface StockConsumeRow {
  date: string
  stockNo: string
  orderNo: string
  usedQty: number
  stockUnitCost: number
  produceQty: number
  produceUnitCost: number
  blendedUnitCost: number
  remaining: number
}

export interface StockIdleRow {
  stockNo: string
  productName: string
  remainingQty: number
  ageDays: number
  amount: number
  level: 'watch' | 'idle'
  suggestion: string
}

export interface OrderExtraReports extends PanelAvailability {
  orderType5: OrderType5Row[]
  backlogMonth: BacklogMonthRow[]
  backlogCustomer: BacklogDimRow[]
  backlogProduct: BacklogDimRow[]
  backlogAlerts: BacklogAlertRow[]
  sampleCycle: SampleCycleRow[]
  sampleCharge: SampleChargeRow[]
  samplePending: SamplePendingRow[]
  stockProgress: StockProgressRow[]
  stockAging: StockAgingRow[]
  stockConsume: StockConsumeRow[]
  stockIdle: StockIdleRow[]
  stockCapital: { totalAmount: number; idleAmount: number; turnoverDays: number; note: string }
}
