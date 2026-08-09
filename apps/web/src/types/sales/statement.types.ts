/* ------------------------------ 客户对账单 STM（本轮补充） ------------------------------ */

export type StatementStatus = 'draft' | 'sent' | 'confirmed' | 'disputed' | 'settled'

export interface StatementLine {
  date: string
  /** 单据类型：发货 / 开票 / 回款 / 退货 / 折让 */
  type: string
  docNo: string
  productName?: string
  quantity?: string
  amount: string
  /** 客户是否已核对该行 */
  matched: boolean
  remark?: string
}

export interface Statement {
  id: string
  docNo: string
  customerCode: string
  customerName: string
  periodFrom: string
  periodTo: string
  currency: string
  openingBalance: string
  shippedAmount: string
  invoicedAmount: string
  receivedAmount: string
  returnAmount: string
  closingBalance: string
  /** 与客户账面的差异金额，非零需说明 */
  differenceAmount: string
  differenceNote?: string
  overdueAmount: string
  status: StatementStatus
  owner: string
  sentAt?: string
  confirmedAt?: string
  lines: StatementLine[]
}
