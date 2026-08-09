import type { OrderType } from './order.types'

/* ------------------------------ 订单追踪 TRK（业务 / 总经办 / PMC 共享） ------------------------------ */

export type TrackStageStatus = 'done' | 'active' | 'pending' | 'blocked'

export interface TrackStage {
  seq: number
  /** 所属阶段：计划与采购 / 来料与检验 / 机加工 / 后处理与委外 / 交付入库 */
  phase: string
  name: string
  /** 进度条上的短标签（进度条空间有限，长名称在悬浮提示里展示） */
  shortName: string
  dept: string
  status: TrackStageStatus
  /** 该环节完成百分比；未给出时由数量或状态推算 */
  progress?: number
  plannedStart?: string
  plannedEnd?: string
  actualStart?: string
  actualEnd?: string
  /** 投入数 / 合格数 / 不良数 */
  qtyIn?: string
  qtyOk?: string
  qtyNg?: string
  /** 该环节停留时长（小时） */
  dwellHours?: number
  remark?: string
}

export interface OrderTracking {
  id: string
  orderNo: string
  customerName: string
  productName: string
  drawingNo: string
  orderType: OrderType
  quantity: string
  deliveryDate: string
  batchNo: string
  /** 当前所处环节名称 */
  currentStage: string
  /** 已完成环节数 / 总环节数 */
  doneCount: number
  totalCount: number
  /** 交付风险：正常 / 临期 / 延期 */
  risk: 'normal' | 'due' | 'late'
  riskNote?: string
  updatedAt: string
  stages: TrackStage[]
}
