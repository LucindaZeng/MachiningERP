import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  BomRequestDraft,
  BomRequestPatch,
  BomRequestQuery,
  BomRequestRecord,
  BomRequestRepositoryPort,
  CreateBomRequestData,
} from './bom-request.repository.port'
import type { BomRequest } from '@prisma/client'

function toRecord(row: BomRequest): BomRequestRecord {
  return {
    id: row.id,
    docNo: row.docNo,
    customerId: row.customerId,
    quotationId: row.quotationId,
    quotationItemId: row.quotationItemId,
    customerPoNo: row.customerPoNo,
    productName: row.productName,
    drawingNo: row.drawingNo,
    drawingVersionId: row.drawingVersionId,
    drawingVersion: row.drawingVersion,
    material: row.material,
    surfaceTreatment: row.surfaceTreatment,
    inspection: row.inspection,
    packing: row.packing,
    quantity: row.quantity.toString(),
    targetDeliveryDate: row.targetDeliveryDate,
    productionType: row.productionType,
    fromSampleNo: row.fromSampleNo,
    specialRequirement: row.specialRequirement,
    status: row.status,
    ownerUserCode: row.ownerUserCode,
    submittedAt: row.submittedAt,
    claimedAt: row.claimedAt,
    claimedBy: row.claimedBy,
    returnedMs: row.returnedMs,
    returnedAt: row.returnedAt,
    returnReason: row.returnReason,
    bomReady: row.bomReady,
    programReady: row.programReady,
    bomReadyAt: row.bomReadyAt,
    programReadyAt: row.programReadyAt,
    productCode: row.productCode,
    versionLock: row.versionLock,
  }
}

function toData(draft: BomRequestDraft): Omit<Prisma.BomRequestCreateInput, 'docNo'> {
  return {
    customerId: draft.customerId,
    quotationId: draft.quotationId,
    quotationItemId: draft.quotationItemId,
    customerPoNo: draft.customerPoNo,
    productName: draft.productName,
    drawingNo: draft.drawingNo,
    drawingVersionId: draft.drawingVersionId,
    drawingVersion: draft.drawingVersion,
    material: draft.material,
    surfaceTreatment: draft.surfaceTreatment,
    inspection: draft.inspection,
    packing: draft.packing,
    quantity: new Prisma.Decimal(draft.quantity),
    targetDeliveryDate: draft.targetDeliveryDate,
    productionType: draft.productionType,
    fromSampleNo: draft.fromSampleNo,
    specialRequirement: draft.specialRequirement,
    ownerUserCode: draft.ownerUserCode,
  }
}

@Injectable()
export class PrismaBomRequestRepository implements BomRequestRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<BomRequestRecord | null> {
    const row = await this.prisma.bomRequest.findUnique({ where: { id } })
    return row ? toRecord(row) : null
  }

  async list(query: BomRequestQuery): Promise<BomRequestRecord[]> {
    const rows = await this.prisma.bomRequest.findMany({
      where: {
        customerId: query.customerId,
        status: query.status,
        productionType: query.productionType,
        ownerUserCode: query.ownerUserCode,
        quotationId: query.quotationId,
        submittedAt:
          query.submittedFrom || query.submittedTo
            ? { gte: query.submittedFrom, lte: query.submittedTo }
            : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    })
    return rows.map(toRecord)
  }

  async create(data: CreateBomRequestData): Promise<BomRequestRecord> {
    const { docNo, createdBy, ...draft } = data
    const row = await this.prisma.bomRequest.create({
      data: { ...toData(draft), docNo, createdBy },
    })
    return toRecord(row)
  }

  /** 只有草稿与被退回的申请可以改内容。 */
  async updateDraft(
    id: string,
    versionLock: number,
    draft: BomRequestDraft,
    updatedBy: string,
  ): Promise<BomRequestRecord | null> {
    const updated = await this.prisma.bomRequest.updateMany({
      where: { id, versionLock, status: { in: ['DRAFT', 'RETURNED'] } },
      data: { ...toData(draft), updatedBy, versionLock: { increment: 1 } },
    })
    if (updated.count !== 1) return null

    return this.findById(id)
  }

  async patch(
    id: string,
    versionLock: number,
    patch: BomRequestPatch,
  ): Promise<BomRequestRecord | null> {
    const updated = await this.prisma.bomRequest.updateMany({
      where: { id, versionLock },
      data: { ...patch, versionLock: { increment: 1 } },
    })
    if (updated.count !== 1) return null

    return this.findById(id)
  }
}
