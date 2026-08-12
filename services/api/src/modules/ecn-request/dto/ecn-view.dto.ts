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
  /** 本轮新增：变更链路与会签明细，前端详情页据此展示 */
  linkage: EcnLinkageView
  signoffs: EcnSignoffView[]
  timeline: DocTimelineNodeView[]
  versionLock: number
}
