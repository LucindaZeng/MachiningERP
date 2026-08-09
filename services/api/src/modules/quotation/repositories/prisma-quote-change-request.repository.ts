import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreateQuoteChangeRequestData,
  HandleQuoteChangeData,
  QuoteChangeRequestRecord,
  QuoteChangeRequestRepositoryPort,
  QuoteTargetPrice,
} from './quote-change-request.repository.port'
import type { QuoteChangeRequest } from '@prisma/client'

/** 目标价在库里是 JSON。金额存字符串，读出来转 bigint，避免 JSON number 丢精度。 */
function toTargetPrices(value: Prisma.JsonValue): QuoteTargetPrice[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return []
    const row = entry as Record<string, unknown>
    return [
      {
        itemSequence: Number(row.itemSequence ?? 0),
        minQuantity: String(row.minQuantity ?? '0'),
        targetPriceMinor: BigInt(String(row.targetPriceMinor ?? '0')),
      },
    ]
  })
}

function fromTargetPrices(targets: readonly QuoteTargetPrice[]): Prisma.InputJsonValue {
  return targets.map((target) => ({
    itemSequence: target.itemSequence,
    minQuantity: target.minQuantity,
    targetPriceMinor: target.targetPriceMinor.toString(),
  }))
}

function toRecord(row: QuoteChangeRequest): QuoteChangeRequestRecord {
  return {
    id: row.id,
    requestNo: row.requestNo,
    quotationId: row.quotationId,
    targetPrices: toTargetPrices(row.targetPrices),
    reason: row.reason,
    status: row.status,
    submittedBy: row.submittedBy,
    submittedAt: row.submittedAt,
    handledBy: row.handledBy,
    handledAt: row.handledAt,
    rejectReason: row.rejectReason,
    revisedCostAnalysisId: row.revisedCostAnalysisId,
    versionLock: row.versionLock,
  }
}

@Injectable()
export class PrismaQuoteChangeRequestRepository implements QuoteChangeRequestRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<QuoteChangeRequestRecord | null> {
    const row = await this.prisma.quoteChangeRequest.findUnique({ where: { id } })
    return row ? toRecord(row) : null
  }

  async listByQuotation(quotationId: string): Promise<QuoteChangeRequestRecord[]> {
    const rows = await this.prisma.quoteChangeRequest.findMany({
      where: { quotationId },
      orderBy: { submittedAt: 'desc' },
    })
    return rows.map(toRecord)
  }

  async create(data: CreateQuoteChangeRequestData): Promise<QuoteChangeRequestRecord> {
    const row = await this.prisma.quoteChangeRequest.create({
      data: {
        requestNo: data.requestNo,
        quotationId: data.quotationId,
        targetPrices: fromTargetPrices(data.targetPrices),
        reason: data.reason,
        submittedBy: data.submittedBy,
      },
    })
    return toRecord(row)
  }

  /** 只有仍处于 SUBMITTED 且版本号匹配时才落地，杜绝重复处理。 */
  async handle(
    id: string,
    versionLock: number,
    data: HandleQuoteChangeData,
  ): Promise<QuoteChangeRequestRecord | null> {
    const updated = await this.prisma.quoteChangeRequest.updateMany({
      where: { id, versionLock, status: 'SUBMITTED' },
      data: {
        status: data.status,
        handledBy: data.handledBy,
        handledAt: data.handledAt,
        rejectReason: data.rejectReason ?? null,
        revisedCostAnalysisId: data.revisedCostAnalysisId ?? null,
        versionLock: { increment: 1 },
      },
    })
    if (updated.count !== 1) return null

    return this.findById(id)
  }
}
