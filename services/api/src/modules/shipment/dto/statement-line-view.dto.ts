/** 对账明细行对外形状，逐字对齐前端 `StatementLine`。 */
export interface StatementLineView {
  id: string
  date: string
  /** 发货 / 开票 / 回款 / 退货 / 折让 */
  type: string
  docNo: string
  productName?: string
  quantity?: string
  amount: string
  matched: boolean
  remark?: string
}
