/* ------------------------------ 核价 QTN-02 ------------------------------ */

export interface CostLine {
  key: string
  label: string
  amount: string
  note: string
  /** 是否属于业务不可见的敏感字段（如未授权供应商底价） */
  restricted?: boolean
}

export interface MetalPriceSnapshot {
  metal: string
  source: string
  quotedAt: string
  price: string
  unit: string
  currency: string
  exchangeRate: string
  /** 快照过期天数阈值，超出触发预警 */
  expired: boolean
}

export interface SimilarProduct {
  drawingNo: string
  productName: string
  customerName: string
  material: string
  quotedPrice: string
  actualCost: string
  marginRate: number
  quotedAt: string
}

export interface CostAnalysis {
  quotationNo: string
  productName: string
  drawingNo: string
  quantity: string
  currency: string
  lines: CostLine[]
  snapshot: MetalPriceSnapshot
  similar: SimilarProduct[]
  targetMarginRate: number
  quotedUnitPrice: string
}
