import type { QuotationItemView } from './quotation-item-view.dto'
import type { QuotationTerms } from '../constants/quotation-terms'
import type { Money } from '@machining-erp/shared'

/**
 * 报价单对外表示。金额一律「定点字符串 + 币种」，绝不出现浮点数。
 *
 * `moldFee` 与单件价并列而不是摊进去：业务规格要求模具费单独列示、单独结算，
 * 摊进单价会让客户按数量重复付模具费。
 */
export interface QuotationView {
  id: string
  docNo: string
  version: number
  customerId: string
  costAnalysisId: string
  template: string
  currency: string
  /** 国外报价的当日汇率快照，展示成小数（如 0.1395） */
  fxRate: number | null
  fxQuotedOn: string | null
  moldFee: Money
  terms: QuotationTerms | null
  status: string
  validUntil: string | null
  submittedBy: string | null
  submittedAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  rejectReason: string | null
  items: QuotationItemView[]
  versionLock: number
}
