/**
 * 报价成本偏差、成本参考值反馈与审核时效
 *
 * 这些是**前后端共享的线上契约**（development-guide §1：packages/shared = 类型/DTO/枚举/错误码）。
 * 后端 DTO 映射器与前端面板编译同一份定义，字段漂移因此是编译错误而不是线上惊喜。
 * fixture 只保留数据，类型从这里反向引入。
 */

import type { PanelAvailability } from './panel-availability'

/** 成本三要素：与 CNC 成本分析表的列口径一致（规格 2.3）。 */
export type CostElement = '材料' | '加工时间' | '工艺'

/** 偏差分级。`alert` 不是「算出来是 0」——没有数据时行集为空，见 panel-availability。 */
export type VarianceLevel = 'ok' | 'watch' | 'alert'

export interface ElementVarianceRow {
  element: CostElement
  quoted: number
  actual: number
  gapRate: number
  orders: number
  share: number
  mainReason: string
}

export interface CostDrillRow {
  dimension: '产品' | '材质' | '报价工程师'
  name: string
  orders: number
  materialGap: number
  timeGap: number
  processGap: number
  totalGap: number
  level: VarianceLevel
  action: string
}

export interface OperationVarianceRow {
  operation: string
  element: CostElement
  orders: number
  quoted: number
  actual: number
  gapRate: number
  reason: string
}

export interface CostRefRow {
  item: string
  scope: string
  current: string
  suggested: string
  basis: string
  status: '待确认' | '已采纳' | '已驳回'
}

export interface SlaNodeRow {
  doc: string
  node: string
  owner: string
  avgHours: number
  p90Hours: number
  slaHours: number
  overdueRate: number
}

export interface StockApprovalRow {
  docNo: string
  productName: string
  qty: number
  amount: number
  submittedAt: string
  approvedAt: string
  hours: number
  slaHours: number
  approver: string
}

export interface CostReports extends PanelAvailability {
  elementVariance: ElementVarianceRow[]
  drill: CostDrillRow[]
  operationVariance: OperationVarianceRow[]
  costRef: CostRefRow[]
  slaNodes: SlaNodeRow[]
  stockApproval: StockApprovalRow[]
  threshold: { warn: number; alert: number; note: string }
}
