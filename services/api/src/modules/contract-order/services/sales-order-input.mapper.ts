import type { SalesOrderDraftPayload } from './sales-order.service'
import type { CreateSalesOrderDto } from '../dto/create-sales-order.dto'

/**
 * HTTP 入参 → 领域形状。
 *
 * 金额在传输层是字符串、进领域层转 bigint；日期转 Date；
 * 可选字段一律落成 null 而不是 undefined，免得下游到处判两种空值。
 */
export function toSalesOrderDraft(dto: CreateSalesOrderDto): SalesOrderDraftPayload {
  return {
    customerId: dto.customerId,
    orderType: dto.orderType,
    chargeMode: dto.chargeMode,
    customerPoNo: dto.customerPoNo ?? null,
    customerPoFile: dto.customerPoFile ?? null,
    currency: dto.currency ?? 'CNY',
    taxRateBps: dto.taxRateBps ?? 1300,
    internalDueDate: dto.internalDueDate ? new Date(dto.internalDueDate) : null,
    costOwner: dto.costOwner ?? null,
    freeReason: dto.freeReason ?? null,
    estimatedCostMinor: dto.estimatedCostMinor == null ? null : BigInt(dto.estimatedCostMinor),
    lines: dto.lines.map((line) => ({
      sequence: line.sequence,
      quotationId: line.quotationId ?? null,
      quotationItemId: line.quotationItemId ?? null,
      costAnalysisId: line.costAnalysisId ?? null,
      productName: line.productName,
      drawingNo: line.drawingNo,
      drawingVersionId: line.drawingVersionId ?? null,
      revision: line.revision ?? null,
      itemCode: line.itemCode ?? null,
      bomRequestNo: line.bomRequestNo ?? null,
      quantity: line.quantity,
      unitPriceMinor: BigInt(line.unitPriceMinor),
      deliveryDate: line.deliveryDate ? new Date(line.deliveryDate) : null,
      remark: line.remark ?? null,
    })),
  }
}
