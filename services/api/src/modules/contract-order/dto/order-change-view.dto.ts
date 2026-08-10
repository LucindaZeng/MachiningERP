export interface OrderChangeRequestView {
  id: string
  requestNo: string
  orderId: string
  orderLineId: string | null
  changeType: string
  changeTypeLabel: string
  origin: string
  urgent: boolean
  beforeValue: string
  afterValue: string
  reason: string
  costOwner: string | null
  status: string
  submittedBy: string
  submittedAt: string
  handledBy: string | null
  handledAt: string | null
  /** 驳回理由原样回到提交人手上 */
  rejectReason: string | null
  versionLock: number
}
