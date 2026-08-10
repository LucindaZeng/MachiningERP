import type { Money } from '@machining-erp/shared'

export interface SalesOrderLineView {
  id: string
  sequence: number
  quotationId: string | null
  quotationItemId: string | null
  costAnalysisId: string | null
  productName: string
  drawingNo: string
  drawingVersionId: string | null
  revision: string | null
  itemCode: string | null
  bomRequestNo: string | null
  quantity: string
  unitPrice: Money
  amount: Money
  deliveryDate: string | null
  remark: string | null
}
