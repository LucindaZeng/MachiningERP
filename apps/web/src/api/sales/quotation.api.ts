import { request } from '../http'

import type {
  CostAnalysis,
  HistoricalQuote,
  Quotation,
  QuoteChangeRequest,
} from '@/types/sales.types'

/** GET /quotations —— 报价列表（QTN-01/03） */
export function fetchQuotations(): Promise<Quotation[]> {
  return request<Quotation[]>({ method: 'GET', url: '/quotations' })
}

/** GET /quotations/cost-analyses —— 核价成本分析（QTN-02） */
export function fetchCostAnalyses(): Promise<Record<string, CostAnalysis>> {
  return request<Record<string, CostAnalysis>>({ method: 'GET', url: '/quotations/cost-analyses' })
}

/** GET /quotations/history —— 历史报价检索（按客户/产品/图号/材料/数量/单价/日期/成交结果） */
export function fetchHistoricalQuotes(): Promise<HistoricalQuote[]> {
  return request<HistoricalQuote[]>({ method: 'GET', url: '/quotations/history' })
}

/** GET /quotations/change-requests —— 报价单修改申请（业务提新价，报价工程师改成本分析或驳回） */
export function fetchQuoteChanges(): Promise<QuoteChangeRequest[]> {
  return request<QuoteChangeRequest[]>({ method: 'GET', url: '/quotations/change-requests' })
}
