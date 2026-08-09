/**
 * 报价单与成本分析表的 Excel 导出。
 * 支持两种口径：
 * 1) 单张导出——一份单据一个工作表；
 * 2) 多选合并导出——把选中的多份单据合并到同一张表，每行标注来源单号，
 *    便于给客户发一份包含多个产品的总报价，或给管理层看一张横向对比的成本分析。
 */
import { exportNotes, exportSheet, type ExportColumn } from '@/utils/export-excel'

import type { CostAnalysis, Quotation } from '@/types/sales.types'

/** 报价单展开成「一份报价 × 一个阶梯」一行 */
export interface QuoteFlatRow {
  docNo: string
  version: string
  customerName: string
  productName: string
  drawingNo: string
  material: string
  surfaceTreatment: string
  tierQty: string
  unitPrice: string
  currency: string
  tradeTerm: string
  targetDeliveryDays: number
  validUntil: string
  grossMarginRate: string
  costAnalysisNo: string
  status: string
  owner: string
}

const QUOTE_COLUMNS: Array<ExportColumn<QuoteFlatRow>> = [
  { label: '报价单号', value: 'docNo', width: 20 },
  { label: '版本', value: 'version', width: 8 },
  { label: '客户', value: 'customerName', width: 26 },
  { label: '产品', value: 'productName', width: 20 },
  { label: '图号', value: 'drawingNo', width: 14 },
  { label: '材料', value: 'material', width: 16 },
  { label: '表面处理', value: 'surfaceTreatment', width: 16 },
  { label: '阶梯数量（件）', value: 'tierQty', width: 14 },
  { label: '单价', value: 'unitPrice', width: 12 },
  { label: '币种', value: 'currency', width: 8 },
  { label: '贸易条件', value: 'tradeTerm', width: 12 },
  { label: '交期（天）', value: 'targetDeliveryDays', width: 11 },
  { label: '有效期至', value: 'validUntil', width: 13 },
  { label: '毛利率', value: 'grossMarginRate', width: 10 },
  { label: '关联成本分析', value: 'costAnalysisNo', width: 20 },
  { label: '状态', value: 'status', width: 10 },
  { label: '业务员', value: 'owner', width: 10 },
]

function flatten(list: Quotation[]): QuoteFlatRow[] {
  return list.flatMap((quote) =>
    (quote.tiers.length ? quote.tiers : [{ quantity: '—', unitPrice: '—' }]).map((tier) => ({
      docNo: quote.docNo,
      version: quote.version,
      customerName: quote.customerName,
      productName: quote.productName,
      drawingNo: `${quote.drawingNo} · ${quote.drawingVersion}`,
      material: quote.material,
      surfaceTreatment: quote.surfaceTreatment,
      tierQty: String(tier.quantity),
      unitPrice: String(tier.unitPrice),
      currency: quote.currency,
      tradeTerm: quote.tradeTerm,
      targetDeliveryDays: quote.targetDeliveryDays,
      validUntil: quote.validUntil,
      grossMarginRate: `${(quote.grossMarginRate * 100).toFixed(1)}%`,
      costAnalysisNo: quote.costAnalysisNo ?? '未关联',
      status: quote.status,
      owner: quote.owner,
    })),
  )
}

export function exportQuotations(list: Quotation[], merged: boolean): void {
  const rows = flatten(list)
  const title = merged ? `合并报价单（${list.length} 份）` : `报价单 ${list[0]?.docNo ?? ''}`
  exportSheet(
    {
      name: merged ? '合并报价单' : '报价单',
      columns: QUOTE_COLUMNS,
      rows,
      notes: exportNotes(title, [
        `包含单号：${list.map((item) => item.docNo).join('、')}`,
        merged
          ? '合并口径：多份报价按阶梯逐行铺开，客户可在同一张表上看到全部产品与阶梯价；各单据的有效期与贸易条件独立生效。'
          : '一份报价按阶梯逐行铺开。',
      ]),
    },
    merged ? '合并报价单' : `报价单-${list[0]?.docNo ?? ''}`,
  )
}

/** 成本分析展开成「一份核价 × 一个成本项」一行 */
export interface CostFlatRow {
  quotationNo: string
  productName: string
  drawingNo: string
  quantity: string
  item: string
  amount: string
  currency: string
  note: string
  totalCost: string
  quotedUnitPrice: string
  marginRate: string
  snapshot: string
}

const COST_COLUMNS: Array<ExportColumn<CostFlatRow>> = [
  { label: '核价单 / 报价单号', value: 'quotationNo', width: 22 },
  { label: '产品', value: 'productName', width: 20 },
  { label: '图号', value: 'drawingNo', width: 14 },
  { label: '核价数量', value: 'quantity', width: 11 },
  { label: '成本项', value: 'item', width: 14 },
  { label: '单位成本', value: 'amount', width: 12 },
  { label: '币种', value: 'currency', width: 8 },
  { label: '口径说明', value: 'note', width: 34 },
  { label: '单件成本合计', value: 'totalCost', width: 14 },
  { label: '报价单价', value: 'quotedUnitPrice', width: 12 },
  { label: '毛利率', value: 'marginRate', width: 10 },
  { label: '行情快照', value: 'snapshot', width: 30 },
]

function flattenCost(list: CostAnalysis[]): CostFlatRow[] {
  return list.flatMap((item) => {
    const total = item.lines.reduce((sum, line) => sum + Number(line.amount || '0'), 0)
    const price = Number(item.quotedUnitPrice || '0')
    const margin = price ? ((price - total) / price) * 100 : 0
    return item.lines.map((line) => ({
      quotationNo: item.quotationNo,
      productName: item.productName,
      drawingNo: item.drawingNo,
      quantity: item.quantity,
      item: line.label,
      // 受限字段（未授权供应商底价）导出时同样脱敏，不因导出绕过字段级权限
      amount: line.restricted ? '***' : line.amount,
      currency: item.currency,
      note: line.note,
      totalCost: total.toFixed(2),
      quotedUnitPrice: item.quotedUnitPrice,
      marginRate: `${margin.toFixed(1)}%`,
      snapshot: `${item.snapshot.metal} · ${item.snapshot.source} · ${item.snapshot.quotedAt}`,
    }))
  })
}

export function exportCostAnalyses(list: CostAnalysis[], merged: boolean): void {
  exportSheet(
    {
      name: merged ? '合并成本分析表' : '成本分析表',
      columns: COST_COLUMNS,
      rows: flattenCost(list),
      notes: exportNotes(merged ? `合并成本分析表（${list.length} 份）` : '成本分析表', [
        `包含核价单：${list.map((item) => item.quotationNo).join('、')}`,
        '受权限保护的成本项（未授权供应商底价）导出为 ***，导出不绕过字段级权限。',
      ]),
    },
    merged ? '合并成本分析表' : `成本分析表-${list[0]?.quotationNo ?? ''}`,
  )
}
