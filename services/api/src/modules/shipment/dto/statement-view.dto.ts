import type { StatementLineView } from './statement-line-view.dto'

/**
 * 客户对账单对外形状，逐字对齐前端 `Statement`。
 * 金额全部由源单汇总得出，没有任何一个字段接受人工赋值。
 */
export interface StatementView {
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
  differenceAmount: string
  differenceNote?: string
  overdueAmount: string
  status: 'draft' | 'sent' | 'confirmed' | 'disputed' | 'settled'
  owner: string
  sentAt?: string
  confirmedAt?: string
  lines: StatementLineView[]
  /** 重算版本号；已发出的版本不可改，只能生成新版 */
  version: number
  versionLock: number
}
