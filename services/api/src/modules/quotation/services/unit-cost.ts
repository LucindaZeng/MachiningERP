import { parseDecimal, type CurrencyCode } from '@machining-erp/shared'
import Decimal from 'decimal.js'

import { calculateCostLine } from './cost-analysis-calculator'

import type { CostAnalysisRecord } from '../repositories/cost-analysis.repository.port'

/**
 * 从成本分析推导每一行的**单件成本**。
 *
 * 两条不能让步的地方：
 *
 * 1. 单件成本由后端算，**绝不接受前端传**。低于成本价的拦截靠的就是这个数，
 *    一旦让调用方自带成本，业务员只要把成本填低就能绕过整条规则。
 * 2. 用全精度中间值 `exact.total` 再除数量，而不是拿四舍五入后的分值去除。
 *    数量是 100、1000 这种量级时，先取整再除会把误差放大成整整一分钱。
 *
 * 成本按**不含税**口径（合计金额而非含税金额）：报价与成本比的是同一口径，
 * 税是另一层的事，混进来会让「低于成本」误判。
 */
export function resolveUnitCosts(record: CostAnalysisRecord): Map<string, bigint> {
  const rates = {
    lossBps: record.lossBps,
    overheadBps: record.overheadBps,
    vatBps: record.vatBps,
    currency: record.currency as CurrencyCode,
  }

  // 逐行算而不是先整表汇总再按下标取回：按下标配对要么多一个「取不到」的兜底分支，
  // 要么在行序变动时静默错位，两种都不划算。
  return new Map(
    record.lines.map((line) => {
      const result = calculateCostLine(
        {
          estimatedWeightKg: line.estimatedWeightKg,
          scrapWeightKg: line.scrapWeightKg,
          materialUnitPriceMinor: line.materialUnitPriceMinor,
          scrapUnitPriceMinor: line.scrapUnitPriceMinor,
          machiningCostMinor: line.machiningCostMinor,
          processCosts: line.processCosts,
        },
        rates,
      )
      return [line.id, divideToMinor(result.exact.total, line.quantity)]
    }),
  )
}

/** 数量为 0 或非法时按整行成本算，宁可报价被判「低于成本」也不能静默当成 0 成本。 */
function divideToMinor(exactTotal: string, quantity: string): bigint {
  const qty = parseDecimal(quantity, '数量')
  const total = new Decimal(exactTotal)
  const perUnit = qty.lessThanOrEqualTo(0) ? total : total.div(qty)

  return BigInt(perUnit.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0))
}
