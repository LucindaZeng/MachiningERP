import { quantityOf } from '@machining-erp/shared'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreateShipmentData,
  ShipmentLineDraft,
  ShipmentLineRecord,
  ShipmentPatch,
  ShipmentQuery,
  ShipmentRecord,
  ShipmentRepositoryPort,
  TailResolution,
} from './shipment.repository.port'
import type { Shipment, ShipmentLine } from '@prisma/client'

type ShipmentRow = Shipment & { lines: ShipmentLine[] }

const WITH_LINES = { lines: { orderBy: { sequence: 'asc' } } } as const

function toLineRecord(row: ShipmentLine): ShipmentLineRecord {
  return {
    id: row.id,
    sequence: row.sequence,
    orderLineId: row.orderLineId,
    productName: row.productName,
    drawingNo: row.drawingNo,
    itemCode: row.itemCode,
    batchNo: row.batchNo,
    orderedQty: row.orderedQty.toString(),
    qualifiedQty: row.qualifiedQty.toString(),
    packedQty: row.packedQty.toString(),
    shippedQty: row.shippedQty.toString(),
    unitPriceMinor: row.unitPriceMinor,
    tailPlan: row.tailPlan,
    tailResolvedQty: row.tailResolvedQty.toString(),
    tailApprovedBy: row.tailApprovedBy,
    tailApprovedAt: row.tailApprovedAt,
    tailRemark: row.tailRemark,
  }
}

function toRecord(row: ShipmentRow): ShipmentRecord {
  return {
    id: row.id,
    docNo: row.docNo,
    orderId: row.orderId,
    customerId: row.customerId,
    deliveryAddressId: row.deliveryAddressId,
    currency: row.currency,
    carrier: row.carrier,
    trackingNo: row.trackingNo,
    invoiceNo: row.invoiceNo,
    replacesReturnId: row.replacesReturnId,
    status: row.status,
    ownerUserCode: row.ownerUserCode,
    packedAt: row.packedAt,
    shippedAt: row.shippedAt,
    signedAt: row.signedAt,
    invoicedAt: row.invoicedAt,
    closedAt: row.closedAt,
    lines: row.lines.map(toLineRecord),
    versionLock: row.versionLock,
  }
}

function toLineData(line: ShipmentLineDraft): Prisma.ShipmentLineCreateWithoutShipmentInput {
  return {
    sequence: line.sequence,
    orderLineId: line.orderLineId,
    productName: line.productName,
    drawingNo: line.drawingNo,
    itemCode: line.itemCode,
    batchNo: line.batchNo,
    orderedQty: new Prisma.Decimal(line.orderedQty),
    qualifiedQty: new Prisma.Decimal(line.qualifiedQty),
    packedQty: new Prisma.Decimal(line.packedQty),
    shippedQty: new Prisma.Decimal(line.shippedQty),
    unitPriceMinor: line.unitPriceMinor,
  }
}

@Injectable()
export class PrismaShipmentRepository implements ShipmentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ShipmentRecord | null> {
    const row = await this.prisma.shipment.findUnique({ where: { id }, include: WITH_LINES })
    return row ? toRecord(row) : null
  }

  async findByDocNo(docNo: string): Promise<ShipmentRecord | null> {
    const row = await this.prisma.shipment.findUnique({ where: { docNo }, include: WITH_LINES })
    return row ? toRecord(row) : null
  }

  async list(query: ShipmentQuery): Promise<ShipmentRecord[]> {
    const rows = await this.prisma.shipment.findMany({
      where: {
        customerId: query.customerId,
        orderId: query.orderId,
        status: query.status,
        ownerUserCode: query.ownerUserCode,
        shippedAt:
          query.shippedFrom || query.shippedTo
            ? { gte: query.shippedFrom, lte: query.shippedTo }
            : undefined,
      },
      include: WITH_LINES,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    })
    return rows.map(toRecord)
  }

  async create(data: CreateShipmentData): Promise<ShipmentRecord> {
    const { docNo, createdBy, lines, ...header } = data
    const row = await this.prisma.shipment.create({
      data: {
        ...header,
        docNo,
        createdBy,
        lines: { create: lines.map(toLineData) },
      },
      include: WITH_LINES,
    })
    return toRecord(row)
  }

  async patch(
    id: string,
    versionLock: number,
    patch: ShipmentPatch,
  ): Promise<ShipmentRecord | null> {
    const updated = await this.prisma.shipment.updateMany({
      where: { id, versionLock },
      data: { ...patch, versionLock: { increment: 1 } },
    })
    if (updated.count !== 1) return null

    return this.findById(id)
  }

  /**
   * 尾数处置整批写回。用事务是因为「几行同时结清」必须是一个原子事实：
   * 结清一半的单据在结案校验里既过不了也说不清。
   */
  async applyTailResolutions(
    id: string,
    versionLock: number,
    resolutions: readonly TailResolution[],
    updatedBy: string,
  ): Promise<ShipmentRecord | null> {
    const applied = await this.prisma.$transaction(async (tx) => {
      const header = await tx.shipment.updateMany({
        where: { id, versionLock },
        data: { updatedBy, versionLock: { increment: 1 } },
      })
      if (header.count !== 1) return false

      for (const resolution of resolutions) {
        await tx.shipmentLine.update({
          where: { id: resolution.lineId },
          data: {
            tailPlan: resolution.tailPlan,
            tailResolvedQty: new Prisma.Decimal(resolution.tailResolvedQty),
            tailApprovedBy: resolution.tailApprovedBy,
            tailApprovedAt: resolution.tailApprovedAt,
            tailRemark: resolution.tailRemark,
          },
        })
      }
      return true
    })

    return applied ? this.findById(id) : null
  }

  async sumShippedByOrderLine(orderLineIds: readonly string[]): Promise<Record<string, string>> {
    if (orderLineIds.length === 0) return {}

    const grouped = await this.prisma.shipmentLine.groupBy({
      by: ['orderLineId'],
      where: {
        orderLineId: { in: [...orderLineIds] },
        // 只算真正发出去的：计划中的出货单不占订单的已发数量
        shipment: { status: { in: ['SHIPPED', 'SIGNED', 'INVOICED', 'CLOSED'] } },
      },
      _sum: { shippedQty: true },
    })

    return Object.fromEntries(
      grouped.map((row) => [row.orderLineId, quantityOf(row._sum.shippedQty?.toString() ?? '0')]),
    )
  }
}
