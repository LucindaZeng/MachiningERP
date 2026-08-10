import type { BomRequestPayloadDto } from '../dto/bom-request-payload.dto'
import type { BomRequestDraft } from '../repositories/bom-request.repository.port'

/** HTTP 入参 → 领域形状。申请人取当前登录用户，不接受调用方指定。 */
export function toBomRequestDraft(
  dto: BomRequestPayloadDto,
  ownerUserCode: string,
): BomRequestDraft {
  return {
    customerId: dto.customerId,
    quotationId: dto.quotationId,
    quotationItemId: dto.quotationItemId,
    drawingVersionId: dto.drawingVersionId,
    customerPoNo: dto.customerPoNo ?? null,
    productName: dto.productName,
    drawingNo: dto.drawingNo,
    drawingVersion: dto.drawingVersion,
    material: dto.material,
    surfaceTreatment: dto.surfaceTreatment,
    inspection: dto.inspection,
    packing: dto.packing,
    quantity: dto.quantity,
    targetDeliveryDate: dto.targetDeliveryDate ? new Date(dto.targetDeliveryDate) : null,
    productionType: dto.productionType,
    fromSampleNo: dto.fromSampleNo ?? null,
    specialRequirement: dto.specialRequirement ?? null,
    ownerUserCode,
  }
}
