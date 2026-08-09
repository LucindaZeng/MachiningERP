import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreateQuotationData,
  QuotationHeaderDraft,
  QuotationItemDraft,
  QuotationRecord,
  QuotationRepositoryPort,
  QuotationStatusPatch,
} from './quotation.repository.port'
import type { QuotationTerms } from '../constants/quotation-terms'

const INCLUDE = {
  items: { orderBy: { sequence: 'asc' }, include: { tiers: { orderBy: { minQuantity: 'asc' } } } },
} satisfies Prisma.QuotationInclude

type Row = Prisma.QuotationGetPayload<{ include: typeof INCLUDE }>

function toRecord(row: Row): QuotationRecord {
  return {
    id: row.id,
    docNo: row.docNo,
    version: row.version,
    rootId: row.rootId,
    customerId: row.customerId,
    costAnalysisId: row.costAnalysisId,
    template: row.template,
    currency: row.currency,
    fxRateMicros: row.fxRateMicros,
    fxQuotedOn: row.fxQuotedOn,
    moldFeeMinor: row.moldFeeMinor,
    terms: (row.terms ?? null) as QuotationTerms | null,
    status: row.status,
    validUntil: row.validUntil,
    submittedBy: row.submittedBy,
    submittedAt: row.submittedAt,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
    rejectReason: row.rejectReason,
    createdBy: row.createdBy,
    versionLock: row.versionLock,
    items: row.items.map((item) => ({
      id: item.id,
      sequence: item.sequence,
      productName: item.productName,
      drawingNo: item.drawingNo,
      drawingVersionId: item.drawingVersionId,
      revision: item.revision,
      material: item.material,
      finishing: item.finishing,
      process: item.process,
      costAnalysisLineId: item.costAnalysisLineId,
      remark: item.remark,
      tiers: item.tiers.map((tier) => ({
        id: tier.id,
        minQuantity: tier.minQuantity.toString(),
        unitPriceMinor: tier.unitPriceMinor,
        unitCostMinor: tier.unitCostMinor,
        label: tier.label,
      })),
    })),
  }
}

function toItemCreate(item: QuotationItemDraft): Prisma.QuotationItemCreateWithoutQuotationInput {
  return {
    sequence: item.sequence,
    productName: item.productName,
    drawingNo: item.drawingNo,
    drawingVersionId: item.drawingVersionId,
    revision: item.revision,
    material: item.material,
    finishing: item.finishing,
    process: item.process,
    costAnalysisLineId: item.costAnalysisLineId,
    remark: item.remark,
    tiers: {
      create: item.tiers.map((tier) => ({
        minQuantity: new Prisma.Decimal(tier.minQuantity),
        unitPriceMinor: tier.unitPriceMinor,
        unitCostMinor: tier.unitCostMinor,
        label: tier.label,
      })),
    },
  }
}

function toHeaderData(header: QuotationHeaderDraft): Prisma.QuotationUpdateInput {
  return {
    template: header.template,
    currency: header.currency,
    fxRateMicros: header.fxRateMicros,
    fxQuotedOn: header.fxQuotedOn,
    moldFeeMinor: header.moldFeeMinor,
    terms: (header.terms ?? Prisma.JsonNull) as Prisma.InputJsonValue,
  }
}

@Injectable()
export class PrismaQuotationRepository implements QuotationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<QuotationRecord | null> {
    const row = await this.prisma.quotation.findUnique({ where: { id }, include: INCLUDE })
    return row ? toRecord(row) : null
  }

  async listByCustomer(customerId: string, limit: number): Promise<QuotationRecord[]> {
    const rows = await this.prisma.quotation.findMany({
      where: { customerId },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map(toRecord)
  }

  async create(data: CreateQuotationData): Promise<QuotationRecord> {
    const row = await this.prisma.quotation.create({
      data: {
        docNo: data.docNo,
        version: data.version,
        rootId: data.rootId,
        customerId: data.customerId,
        costAnalysisId: data.costAnalysisId,
        template: data.template,
        currency: data.currency,
        fxRateMicros: data.fxRateMicros,
        fxQuotedOn: data.fxQuotedOn,
        moldFeeMinor: data.moldFeeMinor,
        terms: (data.terms ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        createdBy: data.createdBy,
        items: { create: data.items.map(toItemCreate) },
      },
      include: INCLUDE,
    })
    return toRecord(row)
  }

  async replaceItems(
    id: string,
    versionLock: number,
    header: QuotationHeaderDraft,
    items: QuotationItemDraft[],
    updatedBy: string,
  ): Promise<QuotationRecord | null> {
    const locked = await this.prisma.quotation.updateMany({
      where: { id, versionLock, status: 'DRAFT' },
      data: { updatedBy, versionLock: { increment: 1 } },
    })
    if (locked.count !== 1) return null

    await this.prisma.quotationItem.deleteMany({ where: { quotationId: id } })
    await this.prisma.quotation.update({
      where: { id },
      data: { ...toHeaderData(header), items: { create: items.map(toItemCreate) } },
    })

    return this.findById(id)
  }

  async updateStatus(
    id: string,
    versionLock: number,
    patch: QuotationStatusPatch,
  ): Promise<QuotationRecord | null> {
    const updated = await this.prisma.quotation.updateMany({
      where: { id, versionLock },
      data: {
        status: patch.status,
        validUntil: patch.validUntil,
        submittedBy: patch.submittedBy,
        submittedAt: patch.submittedAt,
        approvedBy: patch.approvedBy,
        approvedAt: patch.approvedAt,
        rejectReason: patch.rejectReason,
        updatedBy: patch.updatedBy,
        versionLock: { increment: 1 },
      },
    })
    if (updated.count !== 1) return null

    return this.findById(id)
  }
}
