import { quantityOf } from '@machining-erp/shared'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreateSalesReturnData,
  SalesReturnLineDraft,
  SalesReturnLinePatch,
  SalesReturnLineRecord,
  SalesReturnPatch,
  SalesReturnQuery,
  SalesReturnRecord,
  SalesReturnRepositoryPort,
} from './sales-return.repository.port'
import type { SalesReturn, SalesReturnLine } from '@prisma/client'

type SalesReturnRow = SalesReturn & { lines: SalesReturnLine[] }

const WITH_LINES = { lines: { orderBy: { sequence: 'asc' } } } as const

function toLineRecord(row: SalesReturnLine): SalesReturnLineRecord {
  return {
    id: row.id,
    sequence: row.sequence,
    shipmentLineId: row.shipmentLineId,
    orderLineId: row.orderLineId,
    productName: row.productName,
    drawingNo: row.drawingNo,
    batchNo: row.batchNo,
    returnQty: quantityOf(row.returnQty.toString()),
    unitPriceMinor: row.unitPriceMinor,
    amountMinor: row.amountMinor,
    reason: row.reason,
    responsibility: row.responsibility,
    disposition: row.disposition,
    dispositionNote: row.dispositionNote,
    allowanceMinor: row.allowanceMinor,
    receivedAt: row.receivedAt,
    receivedQty: row.receivedQty === null ? null : quantityOf(row.receivedQty.toString()),
    settledByCreditNote: row.settledByCreditNote,
    creditNoteDocNo: row.creditNoteDocNo,
  }
}

function toRecord(row: SalesReturnRow): SalesReturnRecord {
  return {
    id: row.id,
    docNo: row.docNo,
    orderId: row.orderId,
    shipmentId: row.shipmentId,
    customerId: row.customerId,
    currency: row.currency,
    reason: row.reason,
    eightDNo: row.eightDNo,
    eightDRequired: row.eightDRequired,
    status: row.status,
    ownerUserCode: row.ownerUserCode,
    complaintAt: row.complaintAt,
    respondedAt: row.respondedAt,
    judgedAt: row.judgedAt,
    judgedBy: row.judgedBy,
    approvedAt: row.approvedAt,
    approvedBy: row.approvedBy,
    closedAt: row.closedAt,
    needFinanceApproval: row.needFinanceApproval,
    rejectReason: row.rejectReason,
    lines: row.lines.map(toLineRecord),
    versionLock: row.versionLock,
  }
}

function toLineData(line: SalesReturnLineDraft): Prisma.SalesReturnLineCreateWithoutSalesReturnInput {
  return {
    sequence: line.sequence,
    shipmentLineId: line.shipmentLineId,
    orderLineId: line.orderLineId,
    productName: line.productName,
    drawingNo: line.drawingNo,
    batchNo: line.batchNo,
    returnQty: new Prisma.Decimal(line.returnQty),
    unitPriceMinor: line.unitPriceMinor,
    amountMinor: line.amountMinor,
    reason: line.reason,
  }
}

function toLineUpdate(patch: SalesReturnLinePatch): Prisma.SalesReturnLineUpdateInput {
  const data: Prisma.SalesReturnLineUpdateInput = {}
  if (patch.responsibility !== undefined) data.responsibility = patch.responsibility
  if (patch.disposition !== undefined) data.disposition = patch.disposition
  if (patch.dispositionNote !== undefined) data.dispositionNote = patch.dispositionNote
  if (patch.allowanceMinor !== undefined) data.allowanceMinor = patch.allowanceMinor
  if (patch.receivedAt !== undefined) data.receivedAt = patch.receivedAt
  if (patch.receivedQty !== undefined) {
    data.receivedQty = patch.receivedQty === null ? null : new Prisma.Decimal(patch.receivedQty)
  }
  if (patch.settledByCreditNote !== undefined) data.settledByCreditNote = patch.settledByCreditNote
  if (patch.creditNoteDocNo !== undefined) data.creditNoteDocNo = patch.creditNoteDocNo
  return data
}

/** 薄适配器：只做行↔记录的形状转换与乐观锁，业务判断一概不在这里。 */
@Injectable()
export class PrismaSalesReturnRepository implements SalesReturnRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSalesReturnData): Promise<SalesReturnRecord> {
    const { docNo, createdBy, lines, ...header } = data
    const row = await this.prisma.salesReturn.create({
      data: { ...header, docNo, createdBy, lines: { create: lines.map(toLineData) } },
      include: WITH_LINES,
    })
    return toRecord(row)
  }

  async findById(id: string): Promise<SalesReturnRecord | null> {
    const row = await this.prisma.salesReturn.findUnique({ where: { id }, include: WITH_LINES })
    return row ? toRecord(row) : null
  }

  async list(query: SalesReturnQuery): Promise<SalesReturnRecord[]> {
    const rows = await this.prisma.salesReturn.findMany({
      where: {
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.orderId ? { orderId: query.orderId } : {}),
        ...(query.shipmentId ? { shipmentId: query.shipmentId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.ownerUserCode ? { ownerUserCode: query.ownerUserCode } : {}),
        ...(query.closedFrom || query.closedTo
          ? {
              closedAt: {
                ...(query.closedFrom ? { gte: query.closedFrom } : {}),
                ...(query.closedTo ? { lte: query.closedTo } : {}),
              },
            }
          : {}),
      },
      include: WITH_LINES,
      orderBy: { complaintAt: 'desc' },
      ...(query.limit ? { take: query.limit } : {}),
    })
    return rows.map(toRecord)
  }

  async patch(
    id: string,
    versionLock: number,
    patch: SalesReturnPatch,
  ): Promise<SalesReturnRecord | null> {
    const updated = await this.prisma.salesReturn.updateMany({
      where: { id, versionLock },
      data: { ...patch, versionLock: { increment: 1 } },
    })
    if (updated.count !== 1) return null

    return this.findById(id)
  }

  /**
   * 逐行更新整批写回。用事务是因为「几行同时判定 / 同时入库」必须是一个原子事实：
   * 判了一半的单据在结案闸门里既过不了也说不清。
   */
  async patchLines(
    id: string,
    versionLock: number,
    patches: ReadonlyArray<{ lineId: string; patch: SalesReturnLinePatch }>,
    updatedBy: string,
  ): Promise<SalesReturnRecord | null> {
    const applied = await this.prisma.$transaction(async (tx) => {
      const header = await tx.salesReturn.updateMany({
        where: { id, versionLock },
        data: { updatedBy, versionLock: { increment: 1 } },
      })
      if (header.count !== 1) return false

      for (const entry of patches) {
        await tx.salesReturnLine.update({
          where: { id: entry.lineId },
          data: toLineUpdate(entry.patch),
        })
      }
      return true
    })

    return applied ? this.findById(id) : null
  }
}
