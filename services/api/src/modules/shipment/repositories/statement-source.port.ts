/**
 * 对账单源单读端口（业务规格第 7 章「数据与财务应收一致，业务不得手工修改金额」）。
 *
 * 发货明细本模块自己有，开票与退货折让分别属于 invoice-request 与 sales-return，
 * 两者都还没落地，所以这里声明**读**契约 + 明确标注的 stub provider。
 * 回款走 receipt.port.ts，不在这里重复一份。
 */
export interface SourceDocumentEntry {
  occurredAt: Date
  docNo: string
  productName: string | null
  quantity: string | null
  /** 一律取正数；正负号由对账口径在汇总时决定 */
  amountMinor: bigint
  remark: string | null
}

export interface StatementSourcePort {
  /** 期间内已开票（invoice-request 落地后接真实数据） */
  invoicesInPeriod(customerId: string, from: Date, to: Date): Promise<SourceDocumentEntry[]>
  /** 期间内退货与折让（sales-return 落地后接真实数据） */
  returnsInPeriod(customerId: string, from: Date, to: Date): Promise<SourceDocumentEntry[]>
  /** 期初余额：上期期末，由 finance 应收账簿给出 */
  openingBalance(customerId: string, asOf: Date): Promise<bigint>
}

export const STATEMENT_SOURCE_PORT = Symbol('STATEMENT_SOURCE_PORT')
