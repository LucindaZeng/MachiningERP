import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreateInvoiceData,
  InvoiceLineDraft,
  InvoiceLineRecord,
  InvoicePatch,
  InvoiceQuery,
  InvoiceRecord,
  InvoiceRepositoryPort,
} from './invoice-request.repository.port'
import type { InvoiceRequest, InvoiceRequestLine } from '@prisma/client'

type InvoiceRow = InvoiceRequest & { lines: InvoiceRequestLine[] }

const WITH_LINES = { lines: { orderBy: { sequence: 'asc' } } } as const

function toLineRecord(row: InvoiceRequestLine): InvoiceLineRecord {
  return {
    id: row.id,
    sequence: row.sequence,
    shipmentId: row.shipmentId,
    shipmentNo: row.shipmentNo,
    productName: row.productName,
    drawingNo: row.drawingNo,
    quantity: row.quantity.toString(),
    unitPriceMinor: row.unitPriceMinor,
    amountMinor: row.amountMinor,
    taxRateBps: row.taxRateBps,
    taxAmountMinor: row.taxAmountMinor,
  }
}

function toRecord(row: InvoiceRow): InvoiceRecord {
  return {
    id: row.id,
    docNo: row.docNo,
    kind: row.kind,
    originalId: row.originalId,
    customerId: row.customerId,
    invoiceKind: row.invoiceKind,
    statementId: row.statementId,
    currency: row.currency,
    amountExTaxMinor: row.amountExTaxMinor,
    taxAmountMinor: row.taxAmountMinor,
    amountIncTaxMinor: row.amountIncTaxMinor,
    title: row.title,
    taxNo: row.taxNo,
    bankAccount: row.bankAccount,
    address: row.address,
    deliveryMethod: row.deliveryMethod,
    deliveryTarget: row.deliveryTarget,
    amountMatched: row.amountMatched,
    matchNote: row.matchNote,
    expectedPaymentDate: row.expectedPaymentDate,
    status: row.status,
    ownerUserCode: row.ownerUserCode,
    submittedAt: row.submittedAt,
    invoiceNo: row.invoiceNo,
    issuedAt: row.issuedAt,
    sentAt: row.sentAt,
    signedAt: row.signedAt,
    reasonText: row.reasonText,
    lines: row.lines.map(toLineRecord),
    versionLock: row.versionLock,
  }
}

function toLineData(line: InvoiceLineDraft): Prisma.InvoiceRequestLineCreateWithoutInvoiceInput {
  return {
    sequence: line.sequence,
    shipmentId: line.shipmentId,
    shipmentNo: line.shipmentNo,
    productName: line.productName,
    drawingNo: line.drawingNo,
    quantity: new Prisma.Decimal(line.quantity),
    unitPriceMinor: line.unitPriceMinor,
    amountMinor: line.amountMinor,
    taxRateBps: line.taxRateBps,
    taxAmountMinor: line.taxAmountMinor,
  }
}

@Injectable()
export class PrismaInvoiceRequestRepository implements InvoiceRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<InvoiceRecord | null> {
    const row = await this.prisma.invoiceRequest.findUnique({ where: { id }, include: WITH_LINES })
    return row ? toRecord(row) : null
  }

  async list(query: InvoiceQuery): Promise<InvoiceRecord[]> {
    const rows = await this.prisma.invoiceRequest.findMany({
      where: {
        customerId: query.customerId,
        status: query.status,
        invoiceKind: query.invoiceKind,
        kind: query.kind,
        issuedAt:
          query.issuedFrom || query.issuedTo
            ? { gte: query.issuedFrom, lte: query.issuedTo }
            : undefined,
      },
      include: WITH_LINES,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    })
    return rows.map(toRecord)
  }

  async create(data: CreateInvoiceData): Promise<InvoiceRecord> {
    const { lines, createdBy, ...header } = data
    const row = await this.prisma.invoiceRequest.create({
      data: { ...header, createdBy, lines: { create: lines.map(toLineData) } },
      include: WITH_LINES,
    })
    return toRecord(row)
  }

  async patch(id: string, versionLock: number, patch: InvoicePatch): Promise<InvoiceRecord | null> {
    const updated = await this.prisma.invoiceRequest.updateMany({
      where: { id, versionLock },
      data: { ...patch, versionLock: { increment: 1 } },
    })
    if (updated.count !== 1) return null

    return this.findById(id)
  }

  /** 只算**已开出**的红字发票；还在申请中的不占额度。 */
  async creditedAmountOf(originalId: string): Promise<bigint> {
    const rows = await this.prisma.invoiceRequest.findMany({
      where: { originalId, kind: 'CREDIT_NOTE', status: 'COMPLETED' },
      select: { amountIncTaxMinor: true },
    })
    // 红字金额存的是负数，取绝对值累加成「已冲多少」
    return rows.reduce((sum, row) => sum + absOf(row.amountIncTaxMinor), 0n)
  }
}

function absOf(value: bigint): bigint {
  return value < 0n ? -value : value
}
