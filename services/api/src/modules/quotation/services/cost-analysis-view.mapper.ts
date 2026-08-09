import { fromMinor, type CurrencyCode } from '@machining-erp/shared'

import type { CostAnalysisTotals } from './cost-analysis-calculator'
import type { CostAnalysisView } from '../dto/cost-analysis-view.dto'
import type { CostAnalysisRecord } from '../repositories/cost-analysis.repository.port'

const BPS_SCALE = 10_000

/** 成本分析记录 + 计算结果 → 对外表示。金额一律转成定点字符串 + 币种。 */
export function toCostAnalysisView(
  record: CostAnalysisRecord,
  totals: CostAnalysisTotals,
): CostAnalysisView {
  const currency = record.currency as CurrencyCode

  return {
    id: record.id,
    docNo: record.docNo,
    version: record.version,
    customerId: record.customerId,
    productModel: record.productModel,
    lossRatio: record.lossBps / BPS_SCALE,
    overheadRatio: record.overheadBps / BPS_SCALE,
    vatRatio: record.vatBps / BPS_SCALE,
    currency: record.currency,
    processColumns: record.processColumns,
    status: record.status,
    preparedBy: record.preparedBy,
    completedAt: record.completedAt?.toISOString() ?? null,
    versionLock: record.versionLock,
    lines: record.lines.map((line, index) => {
      const computed = totals.lines[index]
      return {
        id: line.id,
        sequence: line.sequence,
        blankType: line.blankType,
        drawingNo: line.drawingNo,
        spec: line.spec,
        revision: line.revision,
        material: line.material,
        quantity: line.quantity,
        estimatedWeightKg: line.estimatedWeightKg,
        netWeightKg: line.netWeightKg,
        scrapWeightKg: line.scrapWeightKg,
        machiningMethod: line.machiningMethod,
        machiningMinutes: line.machiningMinutes,
        materialUnitPrice: fromMinor({ minor: line.materialUnitPriceMinor, currency }),
        materialPriceOverridden: line.materialPriceOverridden,
        materialAmount: fromMinor(computed?.materialAmount ?? { minor: 0n, currency }),
        machiningCost: fromMinor({ minor: line.machiningCostMinor, currency }),
        processCosts: Object.fromEntries(
          Object.entries(line.processCosts).map(([key, minor]) => [
            key,
            fromMinor({ minor, currency }),
          ]),
        ),
        loss: fromMinor(computed?.loss ?? { minor: 0n, currency }),
        overhead: fromMinor(computed?.overhead ?? { minor: 0n, currency }),
        total: fromMinor(computed?.total ?? { minor: 0n, currency }),
        totalWithVat: fromMinor(computed?.totalWithVat ?? { minor: 0n, currency }),
        remark: line.remark,
      }
    }),
    total: fromMinor(totals.total),
    totalWithVat: fromMinor(totals.totalWithVat),
  }
}
