import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreateSalesOrderData,
  SalesOrderHeaderDraft,
  SalesOrderLineDraft,
  SalesOrderQuery,
  SalesOrderRecord,
  SalesOrderRepositoryPort,
  SalesOrderStatusPatch,
  StockPrepAvailability,
} from './sales-order.repository.port'
import type { StockPrepStatus } from '@prisma/client'

const INCLUDE = { lines: { orderBy: { sequence: 'asc' } } } satisfies Prisma.SalesOrderInclude

type Row = Prisma.SalesOrderGetPayload<{ include: typeof INCLUDE }>

function toRecord(row: Row): SalesOrderRecord {
  return {
    id: row.id,
    docNo: row.docNo,
    customerId: row.customerId,
    orderType: row.orderType,
    chargeMode: row.chargeMode,
    customerPoNo: row.customerPoNo,
    customerPoFile: row.customerPoFile,
    currency: row.currency,
    taxRateBps: row.taxRateBps,
    internalDueDate: row.internalDueDate,
    costOwner: row.costOwner,
    freeReason: row.freeReason,
    estimatedCostMinor: row.estimatedCostMinor,
    status: row.status,
    submittedAt: row.submittedAt,
    submittedBy: row.submittedBy,
    approvedAt: row.approvedAt,
    rejectReason: row.rejectReason,
    stockedQty: row.stockedQty?.toString() ?? null,
    stockStatus: row.stockStatus,
    createdBy: row.createdBy,
    versionLock: row.versionLock,
    lines: row.lines.map((line) => ({
      id: line.id,
      sequence: line.sequence,
      quotationId: line.quotationId,
      quotationItemId: line.quotationItemId,
      costAnalysisId: line.costAnalysisId,
      productName: line.productName,
      drawingNo: line.drawingNo,
      drawingVersionId: line.drawingVersionId,
      revision: line.revision,
      itemCode: line.itemCode,
      bomRequestNo: line.bomRequestNo,
      quantity: line.quantity.toString(),
      unitPriceMinor: line.unitPriceMinor,
      deliveryDate: line.deliveryDate,
      remark: line.remark,
    })),
  }
}

function toLineCreate(line: SalesOrderLineDraft): Prisma.SalesOrderLineCreateWithoutOrderInput {
  return {
    sequence: line.sequence,
    quotationId: line.quotationId,
    quotationItemId: line.quotationItemId,
    costAnalysisId: line.costAnalysisId,
    productName: line.productName,
    drawingNo: line.drawingNo,
    drawingVersionId: line.drawingVersionId,
    revision: line.revision,
    itemCode: line.itemCode,
    bomRequestNo: line.bomRequestNo,
    quantity: new Prisma.Decimal(line.quantity),
    unitPriceMinor: line.unitPriceMinor,
    deliveryDate: line.deliveryDate,
    remark: line.remark,
  }
}

@Injectable()
export class PrismaSalesOrderRepository implements SalesOrderRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SalesOrderRecord | null> {
    const row = await this.prisma.salesOrder.findUnique({ where: { id }, include: INCLUDE })
    return row ? toRecord(row) : null
  }

  async list(query: SalesOrderQuery): Promise<SalesOrderRecord[]> {
    const rows = await this.prisma.salesOrder.findMany({
      where: {
        customerId: query.customerId,
        orderType: query.orderType,
        status: query.status,
      },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    })
    return rows.map(toRecord)
  }

  async create(data: CreateSalesOrderData): Promise<SalesOrderRecord> {
    const { lines, docNo, createdBy, ...header } = data
    const row = await this.prisma.salesOrder.create({
      data: {
        ...header,
        docNo,
        createdBy,
        stockStatus: header.orderType === 'STOCK_PREP' ? 'PRODUCING' : null,
        lines: { create: lines.map(toLineCreate) },
      },
      include: INCLUDE,
    })
    return toRecord(row)
  }

  async replaceLines(
    id: string,
    versionLock: number,
    header: SalesOrderHeaderDraft,
    lines: SalesOrderLineDraft[],
    updatedBy: string,
  ): Promise<SalesOrderRecord | null> {
    const locked = await this.prisma.salesOrder.updateMany({
      where: { id, versionLock, status: 'DRAFT' },
      data: { updatedBy, versionLock: { increment: 1 } },
    })
    if (locked.count !== 1) return null

    await this.prisma.salesOrderLine.deleteMany({ where: { orderId: id } })
    await this.prisma.salesOrder.update({
      where: { id },
      data: { ...header, lines: { create: lines.map(toLineCreate) } },
    })

    return this.findById(id)
  }

  async updateStatus(
    id: string,
    versionLock: number,
    patch: SalesOrderStatusPatch,
  ): Promise<SalesOrderRecord | null> {
    const updated = await this.prisma.salesOrder.updateMany({
      where: { id, versionLock },
      data: {
        status: patch.status,
        submittedAt: patch.submittedAt,
        submittedBy: patch.submittedBy,
        approvedAt: patch.approvedAt,
        rejectReason: patch.rejectReason,
        updatedBy: patch.updatedBy,
        versionLock: { increment: 1 },
      },
    })
    if (updated.count !== 1) return null

    return this.findById(id)
  }

  async setCustomerPoFile(id: string, objectKey: string, updatedBy: string): Promise<void> {
    await this.prisma.salesOrder.update({
      where: { id },
      data: { customerPoFile: objectKey, updatedBy },
    })
  }

  async recordStockIn(id: string, stockedQty: string, status: StockPrepStatus): Promise<void> {
    await this.prisma.salesOrder.update({
      where: { id },
      data: { stockedQty: new Prisma.Decimal(stockedQty), stockStatus: status },
    })
  }

  /** 只有已完工入库（STOCKED）的备料单才可能被领用 */
  async findStockPrepAvailability(drawingNo: string): Promise<StockPrepAvailability[]> {
    const rows = await this.prisma.salesOrder.findMany({
      where: {
        orderType: 'STOCK_PREP',
        stockStatus: 'STOCKED',
        lines: { some: { drawingNo } },
      },
      include: { lines: true, consumptions: true },
    })
    return rows.map((row) => this.toAvailability(row))
  }

  async findStockPrepById(id: string): Promise<StockPrepAvailability | null> {
    const row = await this.prisma.salesOrder.findFirst({
      where: { id, orderType: 'STOCK_PREP' },
      include: { lines: true, consumptions: true },
    })
    return row ? this.toAvailability(row) : null
  }

  private toAvailability(
    row: Prisma.SalesOrderGetPayload<{ include: { lines: true; consumptions: true } }>,
  ): StockPrepAvailability {
    const total = row.lines.reduce(
      (sum, line) => sum.add(line.quantity),
      new Prisma.Decimal(0),
    )
    const consumed = row.consumptions.reduce(
      (sum, item) => sum.add(item.consumedQty),
      new Prisma.Decimal(0),
    )
    const available = Prisma.Decimal.max(total.sub(consumed), 0)

    return {
      orderId: row.id,
      docNo: row.docNo,
      drawingNo: row.lines[0]?.drawingNo ?? '',
      totalQty: total.toString(),
      consumedQty: consumed.toString(),
      availableQty: available.toString(),
      // 备料单件成本来自其成本分析；成本模块接入前先用预计成本兜底
      unitCostMinor: row.estimatedCostMinor ?? 0n,
      currency: row.currency,
      stockStatus: row.stockStatus,
    }
  }
}
