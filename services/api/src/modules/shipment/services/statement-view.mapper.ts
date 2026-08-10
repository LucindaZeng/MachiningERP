import { fromMinor, type CurrencyCode } from '@machining-erp/shared'

import type { StatementLineView } from '../dto/statement-line-view.dto'
import type { StatementView } from '../dto/statement-view.dto'
import type {
  StatementLineRecord,
  StatementRecord,
} from '../repositories/statement.repository.port'
import type { StatementLineType, StatementStatus } from '@prisma/client'

/** 前端按中文单据类型分组显示，枚举 → 文案的映射只在这里一处。 */
export const STATEMENT_LINE_TYPE_LABEL: Record<StatementLineType, string> = {
  SHIPMENT: '发货',
  INVOICE: '开票',
  RECEIPT: '回款',
  RETURN: '退货',
  ALLOWANCE: '折让',
}

const STATUS_TO_WIRE: Record<StatementStatus, StatementView['status']> = {
  DRAFT: 'draft',
  SENT: 'sent',
  CONFIRMED: 'confirmed',
  DISPUTED: 'disputed',
  SETTLED: 'settled',
}

/** 客户编号与名称在 masterdata 里，由调用方查好传进来。 */
export interface StatementNaming {
  customerCode: string
  customerName: string
  ownerName: string
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function toLineView(line: StatementLineRecord, currency: CurrencyCode): StatementLineView {
  const view: StatementLineView = {
    id: line.id,
    date: toDateOnly(line.occurredAt),
    type: STATEMENT_LINE_TYPE_LABEL[line.type],
    docNo: line.docNo,
    amount: fromMinor({ minor: line.amountMinor, currency }).amount,
    matched: line.matched,
  }
  if (line.productName) view.productName = line.productName
  if (line.quantity) view.quantity = line.quantity
  if (line.remark) view.remark = line.remark
  return view
}

export function toStatementView(record: StatementRecord, naming: StatementNaming): StatementView {
  const currency = record.currency as CurrencyCode
  const money = (minor: bigint): string => fromMinor({ minor, currency }).amount

  const view: StatementView = {
    id: record.id,
    docNo: record.docNo,
    customerCode: naming.customerCode,
    customerName: naming.customerName,
    periodFrom: toDateOnly(record.periodFrom),
    periodTo: toDateOnly(record.periodTo),
    currency: record.currency,
    openingBalance: money(record.openingBalanceMinor),
    shippedAmount: money(record.shippedAmountMinor),
    invoicedAmount: money(record.invoicedAmountMinor),
    receivedAmount: money(record.receivedAmountMinor),
    returnAmount: money(record.returnAmountMinor),
    closingBalance: money(record.closingBalanceMinor),
    differenceAmount: money(record.differenceAmountMinor),
    overdueAmount: money(record.overdueAmountMinor),
    status: STATUS_TO_WIRE[record.status],
    owner: naming.ownerName,
    lines: record.lines.map((line) => toLineView(line, currency)),
    version: record.version,
    versionLock: record.versionLock,
  }

  if (record.differenceNote) view.differenceNote = record.differenceNote
  if (record.sentAt) view.sentAt = record.sentAt.toISOString()
  if (record.confirmedAt) view.confirmedAt = record.confirmedAt.toISOString()

  return view
}
