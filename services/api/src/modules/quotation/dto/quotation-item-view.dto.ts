import type { QuotationTierView } from './quotation-tier-view.dto'

export interface QuotationItemView {
  id: string
  sequence: number
  productName: string
  drawingNo: string
  drawingVersionId: string | null
  revision: string | null
  material: string | null
  finishing: string | null
  process: string | null
  costAnalysisLineId: string | null
  remark: string | null
  tiers: QuotationTierView[]
}
