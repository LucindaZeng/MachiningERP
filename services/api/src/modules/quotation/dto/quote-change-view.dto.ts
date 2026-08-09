import type { Money } from '@machining-erp/shared'

export interface QuoteChangeRequestView {
  id: string
  requestNo: string
  quotationId: string
  targetPrices: Array<{ itemSequence: number; minQuantity: string; targetPrice: Money }>
  reason: string
  status: string
  submittedBy: string
  submittedAt: string
  handledBy: string | null
  handledAt: string | null
  /** 驳回理由必须原样回到业务员的工作台 */
  rejectReason: string | null
  revisedCostAnalysisId: string | null
  versionLock: number
}
