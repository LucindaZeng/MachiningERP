import { StateMachine } from '../../../platform/state-machine'

import type { QuotationStatus, QuoteChangeStatus } from '@prisma/client'

/**
 * 报价单状态机。
 *
 * 驳回不是一个独立状态——退回后单据回到 DRAFT，驳回理由留在 rejectReason 上，
 * 这样业务员在工作台里看到的就是「一张可以继续改的草稿 + 一条驳回原因」，
 * 不用再为「已驳回」单独做一套编辑规则。
 */
export const QUOTATION_TRANSITIONS = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['EFFECTIVE', 'DRAFT'],
  /** 生效后不能再改价，改价一律生成新版本；成交/丢单/过期是三个终态 */
  EFFECTIVE: ['WON', 'LOST', 'EXPIRED'],
  WON: [],
  LOST: [],
  EXPIRED: [],
} as const satisfies Record<QuotationStatus, readonly QuotationStatus[]>

export const quotationStateMachine = new StateMachine<QuotationStatus>(
  '报价单',
  QUOTATION_TRANSITIONS,
)

/** 报价单修改申请：提交后由报价工程师重核或驳回，两者都是终态。 */
export const QUOTE_CHANGE_TRANSITIONS = {
  SUBMITTED: ['REVISED', 'REJECTED'],
  REVISED: [],
  REJECTED: [],
} as const satisfies Record<QuoteChangeStatus, readonly QuoteChangeStatus[]>

export const quoteChangeStateMachine = new StateMachine<QuoteChangeStatus>(
  '报价单修改申请',
  QUOTE_CHANGE_TRANSITIONS,
)

/** 报价单处于哪些状态时明细可改 */
export function isQuotationEditable(status: QuotationStatus): boolean {
  return status === 'DRAFT'
}
