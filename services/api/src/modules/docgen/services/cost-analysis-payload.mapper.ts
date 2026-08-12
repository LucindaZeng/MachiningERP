import { TEMPLATE_DEFINITIONS, DOCGEN_TEMPLATES } from '../constants/template-registry'

import { bpsToPercent, decimalToNumber, minorToNumber, toDateText } from './money-format'

import type { CostAnalysisRecord, CostAnalysisTotals } from '../../quotation'

/**
 * 成本分析记录 → 模板数据。
 *
 * **金额一律取后端算出来的值**，模板里那些 `=Y5*1.13` 的公式在制作模板时
 * 已被清掉（见 tools/docgen/author-example-templates.mjs 的注释）。
 * 两个理由：ExcelJS 复制行不会调整公式里的行号；以及费率是逐单可调的，
 * 模板里写死的 5%／13% 早晚与记录对不上。算一遍就够了，算两遍必然分家。
 */

export interface CostAnalysisNaming {
  customerName: string
}

export function toCostAnalysisPayload(
  record: CostAnalysisRecord,
  totals: CostAnalysisTotals,
  naming: CostAnalysisNaming,
  issuedOn: Date,
): Record<string, unknown> {
  const columns = TEMPLATE_DEFINITIONS[DOCGEN_TEMPLATES.COST_ANALYSIS_CNC].processColumns ?? 0

  return {
    docNo: record.docNo,
    version: record.version,
    productModel: record.productModel,
    currency: record.currency,
    preparedOn: toDateText(issuedOn),
    preparedBy: record.preparedBy,
    customer: { name: naming.customerName },
    lossPercent: bpsToPercent(record.lossBps),
    overheadPercent: bpsToPercent(record.overheadBps),
    vatPercent: bpsToPercent(record.vatBps),
    ...processLabels(record, columns),
    total: minorToNumber(totals.total.minor),
    totalWithTax: minorToNumber(totals.totalWithVat.minor),
    lines: record.lines.map((line, index) => toLineRow(line, totals, record, index, columns)),
  }
}

/** 工艺列表头：列可加减，因此表头也是标记。用不到的列留空。 */
function processLabels(record: CostAnalysisRecord, columns: number): Record<string, unknown> {
  const labels: Record<string, unknown> = {}
  for (let index = 0; index < columns; index += 1) {
    labels[`processLabel${index + 1}`] = record.processColumns[index]?.label ?? null
  }
  return labels
}

function toLineRow(
  line: CostAnalysisRecord['lines'][number],
  totals: CostAnalysisTotals,
  record: CostAnalysisRecord,
  index: number,
  columns: number,
): Record<string, unknown> {
  const computed = totals.lines[index]
  const row: Record<string, unknown> = {
    blankType: line.blankType,
    drawingNo: line.drawingNo,
    spec: line.spec,
    quantity: decimalToNumber(line.quantity),
    material: line.material,
    estimatedWeightKg: decimalToNumber(line.estimatedWeightKg),
    netWeightKg: decimalToNumber(line.netWeightKg),
    scrapWeightKg: decimalToNumber(line.scrapWeightKg),
    scrapUnitPrice: minorToNumber(line.scrapUnitPriceMinor),
    materialUnitPrice: minorToNumber(line.materialUnitPriceMinor),
    machiningMethod: line.machiningMethod,
    machiningMinutes: decimalToNumber(line.machiningMinutes),
    machiningAmount: minorToNumber(line.machiningCostMinor),
    remark: line.remark ?? '',
    materialAmount: minorToNumber(computed?.materialAmount.minor),
    lossAmount: minorToNumber(computed?.loss.minor),
    overheadAmount: minorToNumber(computed?.overhead.minor),
    subtotal: minorToNumber(computed?.total.minor),
    taxAmount: taxOf(computed),
    totalWithTax: minorToNumber(computed?.totalWithVat.minor),
  }

  for (let column = 0; column < columns; column += 1) {
    const key = record.processColumns[column]?.key
    row[`process${column + 1}`] =
      key === undefined ? null : minorToNumber(line.processCosts[key] ?? 0n)
  }

  return row
}

/** 税额 = 含税 − 不含税。不另立公式，避免与 calculateCostLine 出现第二套算法。 */
function taxOf(computed: CostAnalysisTotals['lines'][number] | undefined): number | null {
  if (!computed) return null
  return minorToNumber(computed.totalWithVat.minor - computed.total.minor)
}

/** 合并比较表用的摊平行：一行一条明细。 */
export function toCostAnalysisMergeRows(
  record: CostAnalysisRecord,
  totals: CostAnalysisTotals,
  customerName: string,
): Array<Record<string, unknown>> {
  return record.lines.map((line, index) => {
    const computed = totals.lines[index]
    return {
      docNo: record.docNo,
      version: record.version,
      customerName,
      productModel: record.productModel,
      drawingNo: line.drawingNo,
      material: line.material,
      quantity: decimalToNumber(line.quantity),
      materialAmount: minorToNumber(computed?.materialAmount.minor),
      machiningAmount: minorToNumber(line.machiningCostMinor),
      subtotal: minorToNumber(computed?.total.minor),
      totalWithTax: minorToNumber(computed?.totalWithVat.minor),
      currency: record.currency,
    }
  })
}
