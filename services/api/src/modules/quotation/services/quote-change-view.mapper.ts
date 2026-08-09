import { fromMinor, type CurrencyCode } from '@machining-erp/shared'

import type { QuoteChangeRequestView } from '../dto/quote-change-view.dto'
import type { QuoteChangeRequestRecord } from '../repositories/quote-change-request.repository.port'

export function toQuoteChangeView(
  record: QuoteChangeRequestRecord,
  currency: CurrencyCode,
): QuoteChangeRequestView {
  return {
    id: record.id,
    requestNo: record.requestNo,
    quotationId: record.quotationId,
    targetPrices: record.targetPrices.map((target) => ({
      itemSequence: target.itemSequence,
      minQuantity: target.minQuantity,
      targetPrice: fromMinor({ minor: target.targetPriceMinor, currency }),
    })),
    reason: record.reason,
    status: record.status,
    submittedBy: record.submittedBy,
    submittedAt: record.submittedAt.toISOString(),
    handledBy: record.handledBy,
    handledAt: record.handledAt?.toISOString() ?? null,
    rejectReason: record.rejectReason,
    revisedCostAnalysisId: record.revisedCostAnalysisId,
    versionLock: record.versionLock,
  }
}
