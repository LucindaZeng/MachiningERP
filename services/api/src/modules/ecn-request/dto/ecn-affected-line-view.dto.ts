/** 受影响数量的对外形状。计数口径：只要生产（车床/CNC）动了就计入。 */
export interface EcnAffectedLineView {
  productName: string
  drawingNo: string
  affectedQty: string
  note: string | null
  enteredBy: string
  enteredAt: string
}
