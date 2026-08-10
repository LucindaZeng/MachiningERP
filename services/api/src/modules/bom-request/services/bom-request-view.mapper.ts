import { canPlaceOrder } from '../constants/bom-request-states'

import type { BomRequestView } from '../dto/bom-request-view.dto'
import type { BomRequestRecord } from '../repositories/bom-request.repository.port'

const MS_PER_HOUR = 3_600_000

export function toBomRequestView(record: BomRequestRecord): BomRequestView {
  return {
    id: record.id,
    docNo: record.docNo,
    customerId: record.customerId,
    quotationId: record.quotationId,
    quotationItemId: record.quotationItemId,
    customerPoNo: record.customerPoNo,
    productName: record.productName,
    drawingNo: record.drawingNo,
    drawingVersionId: record.drawingVersionId,
    drawingVersion: record.drawingVersion,
    material: record.material,
    surfaceTreatment: record.surfaceTreatment,
    inspection: record.inspection,
    packing: record.packing,
    quantity: record.quantity,
    targetDeliveryDate: record.targetDeliveryDate?.toISOString() ?? null,
    productionType: record.productionType,
    fromSampleNo: record.fromSampleNo,
    specialRequirement: record.specialRequirement,
    status: record.status,
    ownerUserCode: record.ownerUserCode,
    submittedAt: record.submittedAt?.toISOString() ?? null,
    claimedAt: record.claimedAt?.toISOString() ?? null,
    claimedBy: record.claimedBy,
    returnedHours: Math.round((Number(record.returnedMs) / MS_PER_HOUR) * 100) / 100,
    returnReason: record.returnReason,
    // 两个开关分别透出，绝不合并成「全部工程完成」
    bomReady: record.bomReady,
    programReady: record.programReady,
    bomReadyAt: record.bomReadyAt?.toISOString() ?? null,
    programReadyAt: record.programReadyAt?.toISOString() ?? null,
    productCode: record.productCode,
    canPlaceOrder: canPlaceOrder(record.status),
    versionLock: record.versionLock,
  }
}
