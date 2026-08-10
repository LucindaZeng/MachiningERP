import type { Money, TimelineNode } from './common.types'

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

/**
 * 退货明细行：一张退货单可以退多项产品。
 *
 * **责任归属与处置方式的真相在行上**：同一张 RMA 里「本厂加工不良」与
 * 「委外表处不良」可以并存（fixture RT1 就是），单头那两个同名字段是派生视图
 * ——全行一致时取该值，不一致时回落为 undecided 并置 mixed 标记。
 * 下面几个字段都是可选的，既有页面不读它们也照常工作。
 */
export interface ReturnLine {
  seq: number
  productName: string
  drawingNo: string
  batchNo: string
  returnQty: string
  reason: string
  amount: string
  responsibility?: ReturnResponsibility
  disposition?: ReturnDisposition
  dispositionNote?: string
  /** 让步接收谈定的减价额（只有让步用，且必填） */
  allowance?: string
  /** 不良品实物入库时间；返工行没有它就不能开工 */
  receivedAt?: string
  receivedQty?: string
  /** 该行扣减是否已由红字发票承接，避免对账重复冲减 */
  settledByCreditNote?: boolean
  creditNoteDocNo?: string
}

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
  /** 单头派生值：全行一致取该值，按行不一时为 undecided 且 mixedResponsibility 为真 */
  responsibility: ReturnResponsibility
  /** 单头派生值：同上，真相在 lines[].disposition */
  disposition: ReturnDisposition
  amount: Money
  complaintAt: string
  respondedAt?: string
  eightDNo?: string
  status: ReturnStatus
  owner: string
  needFinanceApproval: boolean
  timeline: TimelineNode[]
  /** 单头两个派生字段是不是「按行不一」——为真时提示用户展开明细看 */
  mixedResponsibility?: boolean
  mixedDisposition?: boolean
  /** 结案即锁死金额；对账单在结案期间计入退货折让 */
  closedAt?: string
  rejectReason?: string
  versionLock?: number
}
