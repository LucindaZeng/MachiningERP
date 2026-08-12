/**
 * 客户流失预警、产品与材质工艺、出货达成与退货责任
 *
 * 这些是**前后端共享的线上契约**（development-guide §1：packages/shared = 类型/DTO/枚举/错误码）。
 * 后端 DTO 映射器与前端面板编译同一份定义，字段漂移因此是编译错误而不是线上惊喜。
 * fixture 只保留数据，类型从这里反向引入。
 */

import type { PanelAvailability } from './panel-availability'

export interface ChurnRow {
  customer: string
  grade: 'A' | 'B' | 'C'
  lastOrderAt: string
  daysSince: number
  avgIntervalDays: number
  amountChange: number
  level: 'watch' | 'risk' | 'churn'
  owner: string
  followedAt: string
  followResult: string
  nextAction: string
}

export interface ProductProcessRow {
  productName: string
  drawingNo: string
  material: string
  processRoute: string
  orders: number
  amount: number
  marginRate: number
  machineHours: number
  difficulty: '常规' | '较难' | '难加工'
  note: string
}

export interface MaterialProcessCell {
  material: string
  turning: number
  milling: number
  fourAxis: number
  outsource: number
}

export interface PartialShipRow {
  orderNo: string
  customer: string
  productName: string
  orderQty: number
  shippedQty: number
  remainQty: number
  tailPath: string
  dueDate: string
  note: string
}

export interface ShipBlockerRow {
  reason: string
  count: number
  qtyAffected: number
  share: number
  avgDelayDays: number
  owner: string
}

export interface RmaResponsibilityRow {
  responsibility: string
  batches: number
  quantity: number
  lossAmount: number
  share: number
  handled: string
}

export interface MarketReports extends PanelAvailability {
  churn: ChurnRow[]
  productProcess: ProductProcessRow[]
  materialProcess: MaterialProcessCell[]
  partialShip: PartialShipRow[]
  shipBlockers: ShipBlockerRow[]
  rmaResponsibility: RmaResponsibilityRow[]
}
