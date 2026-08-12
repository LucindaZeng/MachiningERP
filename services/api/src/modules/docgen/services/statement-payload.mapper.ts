import { STATEMENT_LINE_TYPE_LABEL } from '../../shipment'

import { decimalToNumber, minorToNumber, toDateText } from './money-format'

import type { StatementRecord } from '../../shipment'

/**
 * 对账单记录 → 模板数据。
 *
 * 行类型的中文名直接用 shipment 导出的 `STATEMENT_LINE_TYPE_LABEL`，
 * 不在这里另起一套：对账单上写「退货折让」而系统别处写「退货」，
 * 客户打电话来问的时候没人说得清是不是同一件事。
 */

export interface StatementNaming {
  customerName: string
  ownerName: string
  basisLabel: string
}

export function toStatementPayload(
  record: StatementRecord,
  naming: StatementNaming,
): Record<string, unknown> {
  return {
    docNo: record.docNo,
    version: record.version,
    currency: record.currency,
    periodFrom: toDateText(record.periodFrom),
    periodTo: toDateText(record.periodTo),
    basisLabel: naming.basisLabel,
    customer: { name: naming.customerName },
    owner: { name: naming.ownerName },
    totals: {
      shipped: minorToNumber(record.shippedAmountMinor),
      // 退货折让在行上是负数，表头这一格给绝对值——表上另有「-」的语义由列名承担
      deduction: minorToNumber(absOf(record.returnAmountMinor)),
      receivable: minorToNumber(record.closingBalanceMinor),
      customerClosing: minorToNumber(record.closingBalanceMinor - record.differenceAmountMinor),
      difference: minorToNumber(record.differenceAmountMinor),
    },
    differenceNote: record.differenceNote ?? '无差异',
    lines: record.lines.map((line) => ({
      docDate: toDateText(line.occurredAt),
      docNo: line.docNo,
      typeLabel: STATEMENT_LINE_TYPE_LABEL[line.type] ?? line.type,
      description: line.productName ?? '',
      quantity: decimalToNumber(line.quantity),
      amount: minorToNumber(line.amountMinor),
      remark: line.remark ?? '',
    })),
  }
}

function absOf(value: bigint): bigint {
  return value < 0n ? -value : value
}
