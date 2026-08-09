/**
 * 敏感字段变更申请的对外表示。
 * controller 只认本 DTO，不接触仓储层类型（development-guide 3.4）。
 */
export interface CustomerChangeRequestView {
  id: string
  requestNo: string
  customerId: string
  changes: Array<{
    field: string
    label: string
    before: string | number | boolean | null
    after: string | number | boolean | null
  }>
  reason: string
  status: string
  submittedBy: string
  submittedAt: string
  decidedBy: string | null
  decidedAt: string | null
  rejectReason: string | null
}
