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
  /**
   * 成本分析主键。服务端 `CostAnalysisView` 一直有下发，只是本地固件里没有；
   * 出具受控成本分析表与合并比较表要按 id 调服务端，因此在契约上补齐。
   * 可选是为了让固件不必逐条编 uuid。
   */
  id?: string
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
