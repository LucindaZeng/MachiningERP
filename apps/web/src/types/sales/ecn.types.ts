import type { TimelineNode } from './common.types'

/* ------------------------------ 工程变更申请 ECN（业务发起） ------------------------------ */

export type EcnChangeType =
  | 'drawing'
  | 'material'
  | 'surface'
  | 'process'
  | 'quantity'
  | 'delivery'
  | 'packing'
  | 'requirement'

export type EcnStatus =
  | 'draft'
  | 'submitted'
  | 'assessing'
  | 'reviewing'
  | 'approved'
  | 'executing'
  | 'closed'
  | 'rejected'

export interface EcnImpact {
  scope: string
  quantity: string
  amount: string
  note: string
}

export interface EngineeringChange {
  id: string
  docNo: string
  customerName: string
  orderNo?: string
  productName: string
  drawingNo: string
  changeType: EcnChangeType
  /** 变更来源：客户要求 or 内部发起 */
  origin: 'customer' | 'internal'
  urgent: boolean
  beforeValue: string
  afterValue: string
  reason: string
  /** 影响范围评估：在制工单、已采购物料、已完工库存、已发货批次 */
  impacts: EcnImpact[]
  /** 改图必须联动改工艺路线 */
  routingUpdated: boolean
  /** 中途改工序：只允许对指定批次版本生效 */
  effectiveBatch?: string
  /** 是否触发订单变更重审与重新核价 */
  needRequote: boolean
  needOrderReapproval: boolean
  status: EcnStatus
  owner: string
  submittedAt?: string
  timeline: TimelineNode[]
}
