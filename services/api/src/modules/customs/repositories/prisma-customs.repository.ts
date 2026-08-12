import { quantityOf } from '@machining-erp/shared'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  AppendCorrectionData,
  AppendDeclarationData,
  AppendDocumentData,
  CreateCustomsDossierData,
  CustomsDossierPatch,
  CustomsDossierRecord,
  CustomsQuery,
  CustomsRepositoryPort,
} from './customs.repository.port'
import type {
  CustomsCorrection,
  CustomsCorrectionLine,
  CustomsDeclaration,
  CustomsDeclarationLine,
  CustomsDocument,
  CustomsDossier,
} from '@prisma/client'

type DossierRow = CustomsDossier & {
  documents: CustomsDocument[]
  declarations: Array<CustomsDeclaration & { lines: CustomsDeclarationLine[] }>
  corrections: Array<CustomsCorrection & { lines: CustomsCorrectionLine[] }>
}

/** 不加 `as const`：Prisma 的 orderBy 只接受可变数组，readonly 元组过不了类型。 */
const WITH_ALL = {
  documents: { orderBy: [{ kind: 'asc' as const }, { version: 'asc' as const }] },
  declarations: { orderBy: { version: 'asc' as const }, include: { lines: true } },
  corrections: { orderBy: { sequence: 'asc' as const }, include: { lines: true } },
}

function toDocumentRecords(row: DossierRow): CustomsDossierRecord['documents'] {
  return row.documents.map((doc) => ({
    id: doc.id,
    kind: doc.kind,
    version: doc.version,
    objectKey: doc.objectKey,
    fileName: doc.fileName,
    exchangeRate: doc.exchangeRate.toString(),
    currency: doc.currency,
    generatedAt: doc.generatedAt,
    generatedBy: doc.generatedBy,
  }))
}

function toDeclarationRecords(row: DossierRow): CustomsDossierRecord['declarations'] {
  return row.declarations.map((declaration) => ({
    id: declaration.id,
    version: declaration.version,
    declaredAt: declaration.declaredAt,
    declaredBy: declaration.declaredBy,
    receiptNo: declaration.receiptNo,
    receiptAt: declaration.receiptAt,
    lines: declaration.lines.map((line) => ({ kind: line.kind, version: line.version })),
  }))
}

function toCorrectionRecords(row: DossierRow): CustomsDossierRecord['corrections'] {
  return row.corrections.map((correction) => ({
    id: correction.id,
    sequence: correction.sequence,
    reason: correction.reason,
    resultingDeclarationVersion: correction.resultingDeclarationVersion,
    createdBy: correction.createdBy,
    createdAt: correction.createdAt,
    lines: correction.lines.map((line) => ({
      kind: line.kind,
      fromVersion: line.fromVersion,
      toVersion: line.toVersion,
    })),
  }))
}

function toRecord(row: DossierRow): CustomsDossierRecord {
  return {
    id: row.id,
    docNo: row.docNo,
    shipmentId: row.shipmentId,
    orderId: row.orderId,
    customerId: row.customerId,
    tradeMode: row.tradeMode,
    incoterm: row.incoterm,
    portOfLoading: row.portOfLoading,
    destination: row.destination,
    destinationPortCode: row.destinationPortCode,
    shippingMarks: row.shippingMarks,
    hsCode: row.hsCode,
    goodsNameCn: row.goodsNameCn,
    goodsNameEn: row.goodsNameEn,
    quantity: quantityOf(row.quantity.toString()),
    unit: row.unit,
    netWeight: row.netWeight.toString(),
    grossWeight: row.grossWeight.toString(),
    packages: row.packages,
    currency: row.currency,
    unitPriceMinor: row.unitPriceMinor,
    totalAmountMinor: row.totalAmountMinor,
    exchangeRate: row.exchangeRate.toString(),
    status: row.status,
    ownerUserCode: row.ownerUserCode,
    checkedBy: row.checkedBy,
    checkedAt: row.checkedAt,
    declarationVersion: row.declarationVersion,
    declaredAt: row.declaredAt,
    releasedAt: row.releasedAt,
    documents: toDocumentRecords(row),
    declarations: toDeclarationRecords(row),
    corrections: toCorrectionRecords(row),
    versionLock: row.versionLock,
  }
}

/** 薄适配器：只做行↔记录的形状转换与乐观锁，业务判断一概不在这里。 */
@Injectable()
export class PrismaCustomsRepository implements CustomsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateCustomsDossierData): Promise<CustomsDossierRecord> {
    const row = await this.prisma.customsDossier.create({
      data: {
        docNo: data.docNo,
        shipmentId: data.shipmentId,
        orderId: data.orderId,
        customerId: data.customerId,
        tradeMode: data.tradeMode,
        incoterm: data.incoterm,
        portOfLoading: data.portOfLoading,
        destination: data.destination,
        destinationPortCode: data.destinationPortCode,
        shippingMarks: data.shippingMarks,
        hsCode: data.hsCode,
        goodsNameCn: data.goodsNameCn,
        goodsNameEn: data.goodsNameEn,
        quantity: new Prisma.Decimal(data.quantity),
        unit: data.unit,
        netWeight: new Prisma.Decimal(data.netWeight),
        grossWeight: new Prisma.Decimal(data.grossWeight),
        packages: data.packages,
        currency: data.currency,
        unitPriceMinor: data.unitPriceMinor,
        totalAmountMinor: data.totalAmountMinor,
        exchangeRate: new Prisma.Decimal(data.exchangeRate),
        ownerUserCode: data.ownerUserCode,
        createdBy: data.createdBy,
      },
      include: WITH_ALL,
    })
    return toRecord(row)
  }

  async findById(id: string): Promise<CustomsDossierRecord | null> {
    const row = await this.prisma.customsDossier.findUnique({ where: { id }, include: WITH_ALL })
    return row ? toRecord(row) : null
  }

  async list(query: CustomsQuery): Promise<CustomsDossierRecord[]> {
    const rows = await this.prisma.customsDossier.findMany({
      where: {
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.shipmentId ? { shipmentId: query.shipmentId } : {}),
        ...(query.orderId ? { orderId: query.orderId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.ownerUserCode ? { ownerUserCode: query.ownerUserCode } : {}),
      },
      include: WITH_ALL,
      orderBy: { createdAt: 'desc' },
      ...(query.limit ? { take: query.limit } : {}),
    })
    return rows.map(toRecord)
  }

  async patch(
    id: string,
    versionLock: number,
    patch: CustomsDossierPatch,
  ): Promise<CustomsDossierRecord | null> {
    const updated = await this.prisma.customsDossier.updateMany({
      where: { id, versionLock },
      data: { ...patch, versionLock: { increment: 1 } },
    })
    if (updated.count !== 1) return null

    return this.findById(id)
  }

  /** 追加一个文件版本。**只 create，永不 update**——旧版原样留着是本模块的核心规则。 */
  async appendDocument(
    id: string,
    versionLock: number,
    data: AppendDocumentData,
    updatedBy: string,
  ): Promise<CustomsDossierRecord | null> {
    const applied = await this.prisma.$transaction(async (tx) => {
      const header = await tx.customsDossier.updateMany({
        where: { id, versionLock },
        data: { updatedBy, versionLock: { increment: 1 } },
      })
      if (header.count !== 1) return false

      await tx.customsDocument.create({
        data: {
          dossierId: id,
          kind: data.kind,
          version: data.version,
          objectKey: data.objectKey,
          fileName: data.fileName,
          exchangeRate: new Prisma.Decimal(data.exchangeRate),
          currency: data.currency,
          generatedBy: data.generatedBy,
        },
      })
      return true
    })

    return applied ? this.findById(id) : null
  }

  /** 申报：清单快照与单头推进必须同一个事务——半张快照说不清送出去了什么。 */
  async appendDeclaration(
    id: string,
    versionLock: number,
    data: AppendDeclarationData,
    patch: CustomsDossierPatch,
  ): Promise<CustomsDossierRecord | null> {
    const applied = await this.prisma.$transaction(async (tx) => {
      const header = await tx.customsDossier.updateMany({
        where: { id, versionLock },
        data: { ...patch, versionLock: { increment: 1 } },
      })
      if (header.count !== 1) return false

      await tx.customsDeclaration.create({
        data: {
          dossierId: id,
          version: data.version,
          declaredAt: data.declaredAt,
          declaredBy: data.declaredBy,
          lines: { create: data.lines.map((line) => ({ kind: line.kind, version: line.version })) },
        },
      })
      return true
    })

    return applied ? this.findById(id) : null
  }

  async appendCorrection(
    id: string,
    versionLock: number,
    data: AppendCorrectionData,
    updatedBy: string,
  ): Promise<CustomsDossierRecord | null> {
    const applied = await this.prisma.$transaction(async (tx) => {
      const header = await tx.customsDossier.updateMany({
        where: { id, versionLock },
        data: { updatedBy, versionLock: { increment: 1 } },
      })
      if (header.count !== 1) return false

      await tx.customsCorrection.create({
        data: {
          dossierId: id,
          sequence: data.sequence,
          reason: data.reason,
          resultingDeclarationVersion: data.resultingDeclarationVersion,
          createdBy: data.createdBy,
          lines: {
            create: data.lines.map((line) => ({
              kind: line.kind,
              fromVersion: line.fromVersion,
              toVersion: line.toVersion,
            })),
          },
        },
      })
      return true
    })

    return applied ? this.findById(id) : null
  }

  async archiveReceipt(
    id: string,
    versionLock: number,
    declarationVersion: number,
    receiptNo: string,
    receiptAt: Date,
    updatedBy: string,
  ): Promise<CustomsDossierRecord | null> {
    const applied = await this.prisma.$transaction(async (tx) => {
      const header = await tx.customsDossier.updateMany({
        where: { id, versionLock },
        data: { updatedBy, versionLock: { increment: 1 } },
      })
      if (header.count !== 1) return false

      await tx.customsDeclaration.updateMany({
        where: { dossierId: id, version: declarationVersion },
        data: { receiptNo, receiptAt },
      })
      return true
    })

    return applied ? this.findById(id) : null
  }
}
