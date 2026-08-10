import { fromMinor, parseDecimal, type CurrencyCode } from '@machining-erp/shared'

import type { SalesOrderLineView } from '../dto/sales-order-line-view.dto'
import type { SalesOrderView } from '../dto/sales-order-view.dto'
import type {
  SalesOrderLineRecord,
  SalesOrderRecord,
} from '../repositories/sales-order.repository.port'

const BPS_SCALE = 10_000

/** 行金额 = 数量 × 单价，用 decimal 算再取整到分，避免大数量下的浮点漂移。 */
function lineAmountMinor(line: SalesOrderLineRecord): bigint {
  const amount = parseDecimal(line.quantity, '数量').mul(line.unitPriceMinor.toString())
  return BigInt(amount.toDecimalPlaces(0).toFixed(0))
}

function toLineView(line: SalesOrderLineRecord, currency: CurrencyCode): SalesOrderLineView {
  return {
    id: line.id,
    sequence: line.sequence,
    quotationId: line.quotationId,
    quotationItemId: line.quotationItemId,
    costAnalysisId: line.costAnalysisId,
    productName: line.productName,
    drawingNo: line.drawingNo,
    drawingVersionId: line.drawingVersionId,
    revision: line.revision,
    itemCode: line.itemCode,
    bomRequestNo: line.bomRequestNo,
    quantity: line.quantity,
    unitPrice: fromMinor({ minor: line.unitPriceMinor, currency }),
    amount: fromMinor({ minor: lineAmountMinor(line), currency }),
    deliveryDate: line.deliveryDate?.toISOString() ?? null,
    remark: line.remark,
  }
}

export function toSalesOrderView(record: SalesOrderRecord): SalesOrderView {
  const currency = record.currency as CurrencyCode
  const total = record.lines.reduce((sum, line) => sum + lineAmountMinor(line), 0n)

  return {
    id: record.id,
    docNo: record.docNo,
    customerId: record.customerId,
    orderType: record.orderType,
    chargeMode: record.chargeMode,
    customerPoNo: record.customerPoNo,
    customerPoFile: record.customerPoFile,
    currency: record.currency,
    taxRate: record.taxRateBps / BPS_SCALE,
    internalDueDate: record.internalDueDate?.toISOString() ?? null,
    costOwner: record.costOwner,
    freeReason: record.freeReason,
    estimatedCost:
      record.estimatedCostMinor === null
        ? null
        : fromMinor({ minor: record.estimatedCostMinor, currency }),
    status: record.status,
    submittedAt: record.submittedAt?.toISOString() ?? null,
    submittedBy: record.submittedBy,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    rejectReason: record.rejectReason,
    stockedQty: record.stockedQty,
    stockStatus: record.stockStatus,
    totalAmount: fromMinor({ minor: total, currency }),
    lines: record.lines.map((line) => toLineView(line, currency)),
    versionLock: record.versionLock,
  }
}
