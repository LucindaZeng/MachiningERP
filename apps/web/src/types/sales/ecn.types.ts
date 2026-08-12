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
  /** 驳回理由；服务端要求必填，会随通知送到发起的业务员手上 */
  rejectReason?: string
  /**
   * 本轮新增：变更链路（图纸版本 ↔ BOM ↔ 报价版本）与跨部门会签明细。
   * 链路是第 6 章「变更可追溯」的落点；会签的 `proxied` 标记让「工程代签」
   * 在界面上无法被误认成部门自己签的。
   */
  linkage?: EcnLinkage
  signoffs?: EcnSignoff[]
  timeline: TimelineNode[]
  /** 乐观锁。每个流转动作都要带它出去，回来的新记录要立刻替换手里这份 */
  versionLock?: number
}

/** 变更链路：这次改动牵动了哪一版图纸、哪张 BOM、哪一版报价。 */
export interface EcnLinkage {
  drawingNo: string
  fromRevision: string | null
  fromVersionId: string | null
  toRevision: string | null
  toVersionId: string | null
  bomRequestId: string | null
  quotationId: string | null
}

/** 会签记录。各部门模块上线前由工程代签，`proxied` 为 true。 */
export interface EcnSignoff {
  department: string
  signedBy: string | null
  signedAt: string | null
  opinion: string | null
  proxied: boolean
}
