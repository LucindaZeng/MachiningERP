import { quantityOf } from '@machining-erp/shared'

import type { CreateShipmentDto } from '../dto/create-shipment.dto'
import type {
  ShipmentHeaderDraft,
  ShipmentLineDraft,
} from '../repositories/shipment.repository.port'

/**
 * HTTP 入参 → 领域草稿。数量在这里统一成定点字符串，金额保持整数最小单位；
 * 这样服务层拿到的形状与仓储层完全一致，中间不再做第二次转换。
 */
export function toShipmentHeaderDraft(
  dto: CreateShipmentDto,
  ownerUserCode: string,
): ShipmentHeaderDraft {
  return {
    orderId: dto.orderId,
    customerId: dto.customerId,
    deliveryAddressId: dto.deliveryAddressId ?? null,
    currency: dto.currency ?? 'CNY',
    carrier: dto.carrier ?? null,
    trackingNo: dto.trackingNo ?? null,
    ownerUserCode,
  }
}

export function toShipmentLineDrafts(dto: CreateShipmentDto): ShipmentLineDraft[] {
  return dto.lines.map((line) => ({
    sequence: line.sequence,
    orderLineId: line.orderLineId,
    productName: line.productName,
    drawingNo: line.drawingNo,
    itemCode: line.itemCode ?? null,
    batchNo: line.batchNo,
    orderedQty: quantityOf(line.orderedQty),
    qualifiedQty: quantityOf(line.qualifiedQty),
    packedQty: quantityOf(line.packedQty),
    shippedQty: quantityOf(line.shippedQty),
    unitPriceMinor: BigInt(line.unitPriceMinor),
  }))
}
