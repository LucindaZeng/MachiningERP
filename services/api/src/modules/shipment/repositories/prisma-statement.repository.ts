import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreateStatementData,
  StatementLineDraft,
  StatementLineRecord,
  StatementPatch,
  StatementQuery,
  StatementRecord,
  StatementRepositoryPort,
} from './statement.repository.port'
import type { Statement, StatementLine } from '@prisma/client'

type StatementRow = Statement & { lines: StatementLine[] }

const WITH_LINES = { lines: { orderBy: { sequence: 'asc' } } } as const

function toLineRecord(row: StatementLine): StatementLineRecord {
  return {
    id: row.id,
    sequence: row.sequence,
    occurredAt: row.occurredAt,
    type: row.type,
    docNo: row.docNo,
    productName: row.productName,
    quantity: row.quantity?.toString() ?? null,
    amountMinor: row.amountMinor,
    matched: row.matched,
    remark: row.remark,
  }
}

function toRecord(row: StatementRow): StatementRecord {
  return {
    id: row.id,
    docNo: row.docNo,
    customerId: row.customerId,
    periodFrom: row.periodFrom,
    periodTo: row.periodTo,
    currency: row.currency,
    version: row.version,
    openingBalanceMinor: row.openingBalanceMinor,
    shippedAmountMinor: row.shippedAmountMinor,
    invoicedAmountMinor: row.invoicedAmountMinor,
    receivedAmountMinor: row.receivedAmountMinor,
    returnAmountMinor: row.returnAmountMinor,
    closingBalanceMinor: row.closingBalanceMinor,
    differenceAmountMinor: row.differenceAmountMinor,
    differenceNote: row.differenceNote,
    overdueAmountMinor: row.overdueAmountMinor,
    status: row.status,
    ownerUserCode: row.ownerUserCode,
    sentAt: row.sentAt,
    confirmedAt: row.confirmedAt,
    lines: row.lines.map(toLineRecord),
    versionLock: row.versionLock,
  }
}

function toLineData(line: StatementLineDraft): Prisma.StatementLineCreateWithoutStatementInput {
  return {
    sequence: line.sequence,
    occurredAt: line.occurredAt,
    type: line.type,
    docNo: line.docNo,
    productName: line.productName,
    quantity: line.quantity === null ? null : new Prisma.Decimal(line.quantity),
    amountMinor: line.amountMinor,
    matched: line.matched,
    remark: line.remark,
  }
}

@Injectable()
export class PrismaStatementRepository implements StatementRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<StatementRecord | null> {
    const row = await this.prisma.statement.findUnique({ where: { id }, include: WITH_LINES })
    return row ? toRecord(row) : null
  }

  async list(query: StatementQuery): Promise<StatementRecord[]> {
    const rows = await this.prisma.statement.findMany({
      where: { customerId: query.customerId, status: query.status },
      include: WITH_LINES,
      orderBy: [{ periodTo: 'desc' }, { version: 'desc' }],
      take: query.limit,
    })
    const records = rows.map(toRecord)
    return query.latestOnly ? keepLatestVersions(records) : records
  }

  async create(data: CreateStatementData): Promise<StatementRecord> {
    const { lines, createdBy, ...header } = data
    const row = await this.prisma.statement.create({
      data: { ...header, createdBy, lines: { create: lines.map(toLineData) } },
      include: WITH_LINES,
    })
    return toRecord(row)
  }

  async patch(
    id: string,
    versionLock: number,
    patch: StatementPatch,
  ): Promise<StatementRecord | null> {
    const updated = await this.prisma.statement.updateMany({
      where: { id, versionLock },
      data: { ...patch, versionLock: { increment: 1 } },
    })
    if (updated.count !== 1) return null

    return this.findById(id)
  }

  async setLineMatched(statementId: string, lineId: string, matched: boolean): Promise<boolean> {
    const updated = await this.prisma.statementLine.updateMany({
      where: { id: lineId, statementId },
      data: { matched },
    })
    return updated.count === 1
  }

  async latestVersion(customerId: string, periodFrom: Date, periodTo: Date): Promise<number> {
    const row = await this.prisma.statement.findFirst({
      where: { customerId, periodFrom, periodTo },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    return row?.version ?? 0
  }
}

/** 同一客户 + 同一期间只留版本号最大的一份；查询已按 version desc 排好序。 */
export function keepLatestVersions(records: readonly StatementRecord[]): StatementRecord[] {
  const seen = new Set<string>()
  return records.filter((record) => {
    const key = `${record.customerId}|${record.periodFrom.toISOString()}|${record.periodTo.toISOString()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
