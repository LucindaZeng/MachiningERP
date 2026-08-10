/** 出货明细行的对外形状，逐字对齐前端 `ShipmentLine`。 */
export interface ShipmentLineView {
  seq: number
  productName: string
  drawingNo: string
  itemCode?: string
  batchNo: string
  orderedQty: string
  shippedQty: string
  tailQty: string
  amount: string
}
