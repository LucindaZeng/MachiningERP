import type { Money, TimelineNode } from './common.types'
import type { ReturnLine } from './shipment.types'

/* ------------------------------ 销退 RMA（本轮补充） ------------------------------ */

export type ReturnStatus =
  | 'registered'
  | 'quality-judging'
  | 'disposition'
  | 'executing'
  | 'closed'
  | 'rejected'

export type ReturnResponsibility = 'company' | 'customer' | 'supplier' | 'undecided'
export type ReturnDisposition =
  | 'refund'
  | 'replacement'
  | 'rework'
  | 'concession'
  | 'scrap'
  | 'undecided'

export interface SalesReturn {
  id: string
  docNo: string
  orderNo: string
  shipmentNo: string
  customerName: string
  productName: string
  /** 一单多产品明细 */
  lines?: ReturnLine[]
  batchNo: string
  returnQty: string
  reason: string
  responsibility: ReturnResponsibility
  disposition: ReturnDisposition
  amount: Money
  complaintAt: string
  respondedAt?: string
  eightDNo?: string
  status: ReturnStatus
  owner: string
  needFinanceApproval: boolean
  timeline: TimelineNode[]
}
