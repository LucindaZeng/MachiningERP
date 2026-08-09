import { parseDecimal, type CurrencyCode, type MoneyMinor } from '@machining-erp/shared'
import Decimal from 'decimal.js'

import { DEFAULT_PROCESS_COLUMNS, type ProcessColumn } from '../constants/process-columns'

export { DEFAULT_PROCESS_COLUMNS }
export type { ProcessColumn }

export const BPS_SCALE = 10_000

export interface CostAnalysisRates {
  /** 损耗率，默认 5%（500 bps），可调 */
  lossBps: number
  /** 管理费利润率，默认 5%（500 bps），可调 */
  overheadBps: number
  /** 增值税率，默认 13%（1300 bps） */
  vatBps: number
  currency: CurrencyCode
}

export const DEFAULT_RATES: CostAnalysisRates = {
  lossBps: 500,
  overheadBps: 500,
  vatBps: 1300,
  currency: 'CNY',
}

export interface CostLineInput {
  /** 预估重量 / KG，decimal 字符串 */
  estimatedWeightKg: string
  /** 余料 / KG */
  scrapWeightKg: string
  /** 材料单价（元/KG），整数最小货币单位 */
  materialUnitPriceMinor: bigint
  /** 余料单价（元/KG） */
  scrapUnitPriceMinor: bigint
  /** 加工金额 */
  machiningCostMinor: bigint
  /** 各工艺列金额，键对应 ProcessColumn.key */
  processCosts: Record<string, bigint>
}

export interface CostLineResult {
  /** 材料金额 = 预估重量 × 材料单价 − 余料 × 余料单价 */
  materialAmount: MoneyMinor
  /** 工艺列合计 */
  processTotal: MoneyMinor
  /** 小计 = 材料金额 + 加工金额 + 工艺列合计 */
  subtotal: MoneyMinor
  /** 损耗 = 小计 × 损耗率 */
  loss: MoneyMinor
  /** 管理费利润 =（小计 + 损耗）× 管理费率 */
  overhead: MoneyMinor
  /** 合计金额 = 小计 + 损耗 + 管理费利润（**不含模具费**） */
  total: MoneyMinor
  /** 含税金额 = 合计金额 ×（1 + 税率） */
  totalWithVat: MoneyMinor
  /**
   * 全精度中间值（以「分」为单位的 decimal 字符串）。
   * 需要继续参与计算的地方（整表汇总、单件成本与报价比对）一律用它，
   * 用四舍五入后的分值继续算会一路累积误差。
   */
  exact: { total: string; totalWithVat: string }
}

function bpsFactor(bps: number): Decimal {
  return new Decimal(bps).div(BPS_SCALE)
}

/** decimal 分值 → 展示用整数分（四舍五入）。 */
function toMinor(value: Decimal, currency: CurrencyCode): MoneyMinor {
  return { minor: BigInt(value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0)), currency }
}

/**
 * 单行成本计算。
 *
 * 公式链已用 `example/成本分析/CNC成本分析.xls` 的三行真实数据逐项验证：
 *
 * ```
 * 材料金额   = 预估重量 × 材料单价 − 余料 × 余料单价
 * 小计       = 材料金额 + 加工金额 + Σ工艺列
 * 损耗       = 小计 × 损耗率(5%)
 * 管理费利润 = (小计 + 损耗) × 管理费率(5%)      ← 对「小计+损耗」取，会复利
 * 合计金额   = 小计 + 损耗 + 管理费利润
 * 含税金额   = 合计金额 × (1 + 13%)
 * ```
 *
 * 两处容易写错、且都被测试钉住：
 *
 * 1. **管理费利润的基数**是「小计 + 损耗」，不是各自对小计取 5%；
 * 2. **中间不取整**。Excel 全程满精度、只在显示时四舍五入，所以这里也必须
 *    用 Decimal 一路算到底，最后才落到分。若每步都取整到分，样例第 4 行会算出
 *    26.39 而表里是 26.38——一分钱的偏差乘上批量就是真金白银。
 *    副作用是「损耗 + 管理费 + 小计」的**显示值**未必正好等于显示的合计，
 *    这与源表现象一致，属于预期行为。
 */
export function calculateCostLine(
  input: CostLineInput,
  rates: CostAnalysisRates = DEFAULT_RATES,
): CostLineResult {
  const currency = rates.currency

  const materialAmount = parseDecimal(input.estimatedWeightKg, '预估重量')
    .mul(input.materialUnitPriceMinor.toString())
    .sub(parseDecimal(input.scrapWeightKg, '余料重量').mul(input.scrapUnitPriceMinor.toString()))

  const processTotal = Object.values(input.processCosts).reduce(
    (sum, minor) => sum.add(minor.toString()),
    new Decimal(0),
  )

  const subtotal = materialAmount.add(input.machiningCostMinor.toString()).add(processTotal)
  const loss = subtotal.mul(bpsFactor(rates.lossBps))
  const overhead = subtotal.add(loss).mul(bpsFactor(rates.overheadBps))
  const total = subtotal.add(loss).add(overhead)
  const totalWithVat = total.mul(bpsFactor(BPS_SCALE + rates.vatBps))

  return {
    materialAmount: toMinor(materialAmount, currency),
    processTotal: toMinor(processTotal, currency),
    subtotal: toMinor(subtotal, currency),
    loss: toMinor(loss, currency),
    overhead: toMinor(overhead, currency),
    total: toMinor(total, currency),
    totalWithVat: toMinor(totalWithVat, currency),
    exact: { total: total.toFixed(), totalWithVat: totalWithVat.toFixed() },
  }
}

export interface CostAnalysisTotals {
  lines: CostLineResult[]
  /** 各行合计之和（不含税、不含模具费）；由全精度值累加后才取整 */
  total: MoneyMinor
  totalWithVat: MoneyMinor
  exact: { total: string; totalWithVat: string }
}

export function calculateCostAnalysis(
  lines: readonly CostLineInput[],
  rates: CostAnalysisRates = DEFAULT_RATES,
): CostAnalysisTotals {
  const results = lines.map((line) => calculateCostLine(line, rates))

  const total = results.reduce((sum, result) => sum.add(result.exact.total), new Decimal(0))
  const totalWithVat = results.reduce(
    (sum, result) => sum.add(result.exact.totalWithVat),
    new Decimal(0),
  )

  return {
    lines: results,
    total: toMinor(total, rates.currency),
    totalWithVat: toMinor(totalWithVat, rates.currency),
    exact: { total: total.toFixed(), totalWithVat: totalWithVat.toFixed() },
  }
}
