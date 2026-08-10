/** 发票明细行的对外形状，逐字对齐前端 `InvoiceLine`。 */
export interface InvoiceLineView {
  seq: number
  shipmentNo: string
  productName: string
  drawingNo: string
  quantity: string
  unitPrice: string
  amount: string
  taxRate: number
  taxAmount: string
}
