import type { SalesReturnLineView } from './sales-return-line-view.dto'
import type { DocTimelineNodeView } from '../../shipment'
import type { DispositionWire, ResponsibilityWire } from '../constants/return-dispositions'

/**
 * 退货单的对外形状，对齐前端 `SalesReturn`。
 *
 * 单头的 `responsibility` / `disposition` **是派生值**，不落库：
 * 全行一致取该值，按行不一时回落到 `undecided` 并置 `mixedDisposition`。
 * 与出货单表头尾数方案同一条道理——多数派标签会歪曲其余的行。
 */
export interface SalesReturnView {
  id: string
  docNo: string
  orderNo: string
  shipmentNo: string
  customerName: string
  productName: string
  lines: SalesReturnLineView[]
  batchNo: string
  returnQty: string
  reason: string
  responsibility: ResponsibilityWire
  disposition: DispositionWire
  amount: { amount: string; currency: string }
  complaintAt: string
  respondedAt?: string
  eightDNo?: string
  status: 'registered' | 'quality-judging' | 'disposition' | 'executing' | 'closed' | 'rejected'
  owner: string
  needFinanceApproval: boolean
  timeline: DocTimelineNodeView[]
  /** 单头两个字段是不是「按行不一」——前端据此提示展开明细看 */
  mixedResponsibility?: boolean
  mixedDisposition?: boolean
  closedAt?: string
  rejectReason?: string
  versionLock: number
}
