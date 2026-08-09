import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CostAnalysisLineDraft,
  CostAnalysisLineRecord,
  CostAnalysisRecord,
  CostAnalysisRepositoryPort,
  CostRateData,
  CreateCostAnalysisData,
} from './cost-analysis.repository.port'
import type { ProcessColumn } from '../constants/process-columns'

const INCLUDE = { lines: { orderBy: { sequence: 'asc' } } } satisfies Prisma.CostAnalysisInclude
type Row = Prisma.CostAnalysisGetPayload<{ include: typeof INCLUDE }>

/** 工艺列金额在库里是 JSON，读出来统一转成 bigint（分）。 */
function toProcessCosts(value: Prisma.JsonValue): Record<string, bigint> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value).map(([key, amount]) => [key, BigInt(String(amount ?? 0))]),
  )
}

function fromProcessCosts(costs: Record<string, bigint>): Prisma.InputJsonValue {
  return Object.fromEntries(Object.entries(costs).map(([key, minor]) => [key, minor.toString()]))
}

function toLine(line: Row['lines'][number]): CostAnalysisLineRecord {
  return {
    id: line.id,
    sequence: line.sequence,
    blankType: line.blankType,
    drawingNo: line.drawingNo,
    drawingVersionId: line.drawingVersionId,
    spec: line.spec,
    revision: line.revision,
    quantity: line.quantity.toString(),
    material: line.material,
    estimatedWeightKg: line.estimatedWeightKg.toString(),
    netWeightKg: line.netWeightKg.toString(),
    scrapWeightKg: line.scrapWeightKg.toString(),
    scrapUnitPriceMinor: line.scrapUnitPriceMinor,
    materialUnitPriceMinor: line.materialUnitPriceMinor,
    materialPriceOverridden: line.materialPriceOverridden,
    materialPriceSourceId: line.materialPriceSourceId,
    machiningMethod: line.machiningMethod,
    machiningMinutes: line.machiningMinutes.toString(),
    machiningCostMinor: line.machiningCostMinor,
    processCosts: toProcessCosts(line.processCosts),
    remark: line.remark,
  }
}

function toRecord(row: Row): CostAnalysisRecord {
  return {
    id: row.id,
    docNo: row.docNo,
    version: row.version,
    rootId: row.rootId,
    customerId: row.customerId,
    productModel: row.productModel,
    lossBps: row.lossBps,
    overheadBps: row.overheadBps,
    vatBps: row.vatBps,
    currency: row.currency,
    processColumns: (row.processColumns ?? []) as unknown as ProcessColumn[],
    status: row.status,
    preparedBy: row.preparedBy,
    completedAt: row.completedAt,
    lines: row.lines.map(toLine),
    versionLock: row.versionLock,
  }
}

function toLineCreate(line: CostAnalysisLineDraft): Prisma.CostAnalysisLineCreateWithoutCostAnalysisInput {
  return {
    sequence: line.sequence,
    blankType: line.blankType,
    drawingNo: line.drawingNo,
    drawingVersionId: line.drawingVersionId,
    spec: line.spec,
    revision: line.revision,
    quantity: new Prisma.Decimal(line.quantity),
    material: line.material,
    estimatedWeightKg: new Prisma.Decimal(line.estimatedWeightKg),
    netWeightKg: new Prisma.Decimal(line.netWeightKg),
    scrapWeightKg: new Prisma.Decimal(line.scrapWeightKg),
    scrapUnitPriceMinor: line.scrapUnitPriceMinor,
    materialUnitPriceMinor: line.materialUnitPriceMinor,
    materialPriceOverridden: line.materialPriceOverridden,
    materialPriceSourceId: line.materialPriceSourceId,
    machiningMethod: line.machiningMethod,
    machiningMinutes: new Prisma.Decimal(line.machiningMinutes),
    machiningCostMinor: line.machiningCostMinor,
    processCosts: fromProcessCosts(line.processCosts),
    remark: line.remark,
  }
}

@Injectable()
export class PrismaCostAnalysisRepository implements CostAnalysisRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<CostAnalysisRecord | null> {
    const row = await this.prisma.costAnalysis.findUnique({ where: { id }, include: INCLUDE })
    return row ? toRecord(row) : null
  }

  async listByCustomer(customerId: string, limit: number): Promise<CostAnalysisRecord[]> {
    const rows = await this.prisma.costAnalysis.findMany({
      where: { customerId },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map(toRecord)
  }

  async create(data: CreateCostAnalysisData): Promise<CostAnalysisRecord> {
    const row = await this.prisma.costAnalysis.create({
      data: {
        docNo: data.docNo,
        version: data.version,
        rootId: data.rootId,
        customerId: data.customerId,
        productModel: data.productModel,
        lossBps: data.lossBps,
        overheadBps: data.overheadBps,
        vatBps: data.vatBps,
        currency: data.currency,
        processColumns: data.processColumns as unknown as Prisma.InputJsonValue,
        preparedBy: data.preparedBy,
        createdBy: data.createdBy,
        lines: { create: data.lines.map(toLineCreate) },
      },
      include: INCLUDE,
    })
    return toRecord(row)
  }

  async updateRates(
    id: string,
    versionLock: number,
    rates: CostRateData,
    updatedBy: string,
  ): Promise<CostAnalysisRecord | null> {
    const updated = await this.prisma.costAnalysis.updateMany({
      where: { id, versionLock, status: { not: 'LOCKED' } },
      data: { ...rates, updatedBy, versionLock: { increment: 1 } },
    })
    if (updated.count !== 1) return null

    return this.findById(id)
  }

  async replaceLines(
    id: string,
    versionLock: number,
    lines: CostAnalysisLineDraft[],
    updatedBy: string,
  ): Promise<CostAnalysisRecord | null> {
    const updated = await this.prisma.costAnalysis.updateMany({
      where: { id, versionLock, status: { not: 'LOCKED' } },
      data: { updatedBy, versionLock: { increment: 1 } },
    })
    if (updated.count !== 1) return null

    await this.prisma.$transaction([
      this.prisma.costAnalysisLine.deleteMany({ where: { costAnalysisId: id } }),
      this.prisma.costAnalysisLine.createMany({
        data: lines.map((line) => ({ ...toLineCreate(line), costAnalysisId: id })),
      }),
    ])

    return this.findById(id)
  }

  async markCompleted(id: string, versionLock: number, at: Date): Promise<boolean> {
    const updated = await this.prisma.costAnalysis.updateMany({
      where: { id, versionLock, status: { not: 'LOCKED' } },
      data: { status: 'COMPLETED', completedAt: at, versionLock: { increment: 1 } },
    })
    return updated.count === 1
  }

  async markLocked(id: string): Promise<void> {
    await this.prisma.costAnalysis.update({ where: { id }, data: { status: 'LOCKED' } })
  }
}
