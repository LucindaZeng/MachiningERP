import type { QuoteChangeStatus } from '@prisma/client'

/** 业务希望改到的目标价：按「产品行 + 起订量」定位到某一档 */
export interface QuoteTargetPrice {
  itemSequence: number
  minQuantity: string
  targetPriceMinor: bigint
}

export interface QuoteChangeRequestRecord {
  id: string
  requestNo: string
  quotationId: string
  targetPrices: QuoteTargetPrice[]
  reason: string
  status: QuoteChangeStatus
  submittedBy: string
  submittedAt: Date
  handledBy: string | null
  handledAt: Date | null
  rejectReason: string | null
  revisedCostAnalysisId: string | null
  versionLock: number
}

export interface CreateQuoteChangeRequestData {
  requestNo: string
  quotationId: string
  targetPrices: QuoteTargetPrice[]
  reason: string
  submittedBy: string
}

/** 处理结果落库：重核带出新成本分析版本，驳回必须带理由 */
export interface HandleQuoteChangeData {
  status: QuoteChangeStatus
  handledBy: string
  handledAt: Date
  rejectReason?: string | null
  revisedCostAnalysisId?: string | null
}

export interface QuoteChangeRequestRepositoryPort {
  findById(id: string): Promise<QuoteChangeRequestRecord | null>
  listByQuotation(quotationId: string): Promise<QuoteChangeRequestRecord[]>
  create(data: CreateQuoteChangeRequestData): Promise<QuoteChangeRequestRecord>
  /** 带乐观锁；版本冲突或已被处理返回 null */
  handle(
    id: string,
    versionLock: number,
    data: HandleQuoteChangeData,
  ): Promise<QuoteChangeRequestRecord | null>
}

export const QUOTE_CHANGE_REQUEST_REPOSITORY = Symbol('QUOTE_CHANGE_REQUEST_REPOSITORY')
