import type { QuotationDraftPayload } from './quotation.service'
import type { CreateQuotationDto } from '../dto/create-quotation.dto'
import type { QuoteTargetPriceDto } from '../dto/quote-target-price.dto'
import type { QuoteTargetPrice } from '../repositories/quote-change-request.repository.port'

/**
 * HTTP 入参 → 领域形状。
 *
 * 金额在传输层是字符串、进领域层转 bigint；**单件成本不在入参里**，
 * 由 service 从成本分析推导（见 unit-cost.ts）。
 */
export function toQuotationDraftPayload(dto: CreateQuotationDto): QuotationDraftPayload {
  return {
    customerId: dto.customerId,
    costAnalysisId: dto.costAnalysisId,
    template: dto.template ?? 'DOMESTIC',
    currency: dto.currency ?? 'CNY',
    fxRateMicros: dto.fxRateMicros == null ? null : BigInt(dto.fxRateMicros),
    fxQuotedOn: dto.fxQuotedOn == null ? null : new Date(dto.fxQuotedOn),
    moldFeeMinor: BigInt(dto.moldFeeMinor ?? '0'),
    terms: dto.terms ?? null,
    items: dto.items.map((item) => ({
      sequence: item.sequence,
      productName: item.productName,
      drawingNo: item.drawingNo,
      drawingVersionId: item.drawingVersionId ?? null,
      revision: item.revision ?? null,
      material: item.material ?? null,
      finishing: item.finishing ?? null,
      process: item.process ?? null,
      costAnalysisLineId: item.costAnalysisLineId ?? null,
      remark: item.remark ?? null,
      tiers: item.tiers.map((tier) => ({
        minQuantity: tier.minQuantity,
        unitPriceMinor: BigInt(tier.unitPriceMinor),
        label: tier.label ?? null,
      })),
    })),
  }
}

export function toTargetPrices(dtos: readonly QuoteTargetPriceDto[]): QuoteTargetPrice[] {
  return dtos.map((dto) => ({
    itemSequence: dto.itemSequence,
    minQuantity: dto.minQuantity,
    targetPriceMinor: BigInt(dto.targetPriceMinor),
  }))
}
