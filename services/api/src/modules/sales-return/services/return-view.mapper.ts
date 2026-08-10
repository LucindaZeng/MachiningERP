import { addQuantity, fromMinor, quantityOf, type CurrencyCode } from '@machining-erp/shared'

import {
  DISPOSITION_TO_WIRE,
  RESPONSIBILITY_TO_WIRE,
} from '../constants/return-dispositions'
import { RETURN_STATUS_TO_WIRE } from '../constants/return-filters'

import {
  isMixedDisposition,
  isMixedResponsibility,
  rollupDisposition,
  rollupResponsibility,
  type ReturnLineFacts,
} from './return-disposition.rules'

import type { DocTimelineNodeView } from '../../shipment'
import type { SalesReturnLineView } from '../dto/sales-return-line-view.dto'
import type { SalesReturnView } from '../dto/sales-return-view.dto'
import type {
  SalesReturnLineRecord,
  SalesReturnRecord,
} from '../repositories/sales-return.repository.port'

const ZERO_QTY = quantityOf('0')

/** 单据号、客户名、业务员姓名都在别的模块里，由调用方查好传进来。 */
export interface ReturnNaming {
  orderNo: string
  shipmentNo: string
  customerName: string
  ownerName: string
}

function toLineView(line: SalesReturnLineRecord, currency: CurrencyCode): SalesReturnLineView {
  const view: SalesReturnLineView = {
    seq: line.sequence,
    productName: line.productName,
    drawingNo: line.drawingNo,
    batchNo: line.batchNo,
    returnQty: line.returnQty,
    reason: line.reason,
    amount: fromMinor({ minor: line.amountMinor, currency }).amount,
    responsibility: RESPONSIBILITY_TO_WIRE[line.responsibility],
    disposition: DISPOSITION_TO_WIRE[line.disposition],
  }

  if (line.dispositionNote) view.dispositionNote = line.dispositionNote
  if (line.allowanceMinor !== null) {
    view.allowance = fromMinor({ minor: line.allowanceMinor, currency }).amount
  }
  if (line.receivedAt) view.receivedAt = line.receivedAt.toISOString()
  if (line.receivedQty) view.receivedQty = line.receivedQty
  if (line.settledByCreditNote) view.settledByCreditNote = true
  if (line.creditNoteDocNo) view.creditNoteDocNo = line.creditNoteDocNo

  return view
}

/** 表头产品名：单行取行名，多行取「首行 等 N 项」，与前端 fixture 的写法一致。 */
function headerProductName(lines: readonly SalesReturnLineRecord[]): string {
  const first = lines[0]
  if (!first) return ''
  return lines.length === 1 ? first.productName : `${first.productName} 等 ${lines.length} 项`
}

function factsOf(record: SalesReturnRecord): ReturnLineFacts[] {
  return record.lines.map((line) => ({
    sequence: line.sequence,
    productName: line.productName,
    responsibility: line.responsibility,
    disposition: line.disposition,
    dispositionNote: line.dispositionNote,
    amountMinor: line.amountMinor,
    allowanceMinor: line.allowanceMinor,
    receivedAt: line.receivedAt,
  }))
}

/**
 * 单头的责任归属与处置方式**在这里现算，不落库**。
 *
 * 全行一致就取该值；按行不一时回落到「待判定」并置 mixed 标记。
 * 与出货单表头尾数方案同一条道理：一个多数派标签会歪曲其余的行，
 * 与其给个看似确定的错答案，不如明说这单要展开看。
 */
export function toSalesReturnView(
  record: SalesReturnRecord,
  naming: ReturnNaming,
  timeline: DocTimelineNodeView[],
): SalesReturnView {
  const currency = record.currency as CurrencyCode
  const facts = factsOf(record)
  const total = record.lines.reduce((sum, line) => sum + line.amountMinor, 0n)

  const view: SalesReturnView = {
    id: record.id,
    docNo: record.docNo,
    orderNo: naming.orderNo,
    shipmentNo: naming.shipmentNo,
    customerName: naming.customerName,
    productName: headerProductName(record.lines),
    lines: record.lines.map((line) => toLineView(line, currency)),
    batchNo: record.lines[0]?.batchNo ?? '',
    returnQty: record.lines.reduce((sum, line) => addQuantity(sum, line.returnQty), ZERO_QTY),
    reason: record.reason,
    responsibility: RESPONSIBILITY_TO_WIRE[rollupResponsibility(facts)],
    disposition: DISPOSITION_TO_WIRE[rollupDisposition(facts)],
    amount: fromMinor({ minor: total, currency }),
    complaintAt: record.complaintAt.toISOString(),
    status: RETURN_STATUS_TO_WIRE[record.status],
    owner: naming.ownerName,
    needFinanceApproval: record.needFinanceApproval,
    timeline,
    versionLock: record.versionLock,
  }

  if (isMixedResponsibility(facts)) view.mixedResponsibility = true
  if (isMixedDisposition(facts)) view.mixedDisposition = true
  if (record.respondedAt) view.respondedAt = record.respondedAt.toISOString()
  if (record.eightDNo) view.eightDNo = record.eightDNo
  if (record.closedAt) view.closedAt = record.closedAt.toISOString()
  if (record.rejectReason) view.rejectReason = record.rejectReason

  return view
}
