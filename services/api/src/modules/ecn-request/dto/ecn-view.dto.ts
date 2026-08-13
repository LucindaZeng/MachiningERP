import type { EcnAffectedLineView } from './ecn-affected-line-view.dto'
import type { EcnImpactView } from './ecn-impact-view.dto'
import type { EcnSignoffView } from './ecn-signoff-view.dto'
import type { DocTimelineNodeView } from '../../shipment'
import type { EcnLinkageView } from '../services/ecn-context.service'

/** 对齐前端 `EngineeringChange`。 */
export interface EcnRequestView {
  id: string
  docNo: string
  customerName: string
  orderNo?: string
  productName: string
  drawingNo: string
  changeType: string
  origin: 'customer' | 'internal'
  urgent: boolean
  beforeValue: string
  afterValue: string
  reason: string
  impacts: EcnImpactView[]
  routingUpdated: boolean
  effectiveBatch?: string
  needRequote: boolean
  needOrderReapproval: boolean
  status: string
  owner: string
  submittedAt?: string
  rejectReason?: string
  /** 生产影响分类（规格第 6 章新增规则）：'none' | 'impacted'；未判定时不下发 */
  productionImpact?: string
  /** PMC 清点录入的受影响数量；无影响的变更恒为空 */
  affectedLines: EcnAffectedLineView[]
  /** 返工已发起时间；一经发起，受影响数量即锁死 */
  reworkInitiatedAt?: string
  /** 本轮新增：变更链路与会签明细，前端详情页据此展示 */
  linkage: EcnLinkageView
  signoffs: EcnSignoffView[]
  timeline: DocTimelineNodeView[]
  versionLock: number
}
