import type { CostRates } from '../constants/cost-rates'
import type { CostAnalysisLineDto } from '../dto/cost-analysis-line.dto'
import type { CostAnalysisLineDraft } from '../repositories/cost-analysis.repository.port'

/**
 * HTTP 入参 → 领域形状。
 *
 * 金额在传输层是**字符串**（JSON 没有 bigint，用 number 传分值迟早会踩到
 * 2^53 与浮点问题），进了领域层一律转成 bigint 再参与计算。
 */
export function toCostAnalysisLineDraft(dto: CostAnalysisLineDto): CostAnalysisLineDraft {
  return {
    sequence: dto.sequence,
    blankType: dto.blankType,
    drawingNo: dto.drawingNo,
    drawingVersionId: dto.drawingVersionId,
    spec: dto.spec,
    revision: dto.revision,
    quantity: dto.quantity,
    material: dto.material,
    estimatedWeightKg: dto.estimatedWeightKg,
    netWeightKg: dto.netWeightKg,
    scrapWeightKg: dto.scrapWeightKg,
    scrapUnitPriceMinor: BigInt(dto.scrapUnitPriceMinor),
    materialUnitPriceMinor: BigInt(dto.materialUnitPriceMinor),
    materialPriceOverridden: dto.materialPriceOverridden,
    materialPriceSourceId: dto.materialPriceSourceId,
    machiningMethod: dto.machiningMethod,
    machiningMinutes: dto.machiningMinutes,
    machiningCostMinor: BigInt(dto.machiningCostMinor),
    processCosts: Object.fromEntries(
      Object.entries(dto.processCosts).map(([key, minor]) => [key, BigInt(minor)]),
    ),
    remark: dto.remark,
  }
}

export function toCostAnalysisLineDrafts(
  dtos: readonly CostAnalysisLineDto[],
): CostAnalysisLineDraft[] {
  return dtos.map(toCostAnalysisLineDraft)
}

/**
 * 可选费率三项 → 领域形状。
 *
 * 要么齐传要么全不传：只传一两项时返回 null（按「不改费率」处理），
 * 而不是把没传的那几项落成默认值——那会让「只想调损耗」把管理费悄悄改掉。
 */
export function toCostRates(input: Partial<CostRates>): CostRates | null {
  const { lossBps, overheadBps, vatBps } = input
  if (lossBps === undefined || overheadBps === undefined || vatBps === undefined) return null

  return { lossBps, overheadBps, vatBps }
}
