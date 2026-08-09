import type { Money } from '@machining-erp/shared'

/** 成本分析明细的对外表示，列口径与 CNC成本分析.xls 逐列对应。 */
export interface CostAnalysisLineView {
  id: string
  sequence: number
  blankType: string
  drawingNo: string
  spec: string
  revision: string | null
  material: string
  quantity: string
  estimatedWeightKg: string
  netWeightKg: string
  scrapWeightKg: string
  machiningMethod: string
  machiningMinutes: string
  materialUnitPrice: Money
  materialPriceOverridden: boolean
  materialAmount: Money
  machiningCost: Money
  processCosts: Record<string, Money>
  loss: Money
  overhead: Money
  total: Money
  totalWithVat: Money
  remark: string | null
}
