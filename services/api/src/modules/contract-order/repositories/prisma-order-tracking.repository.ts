import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  OrderTrackingRepositoryPort,
  TrackingNodeDraft,
  TrackingNodeProgressPatch,
  TrackingNodeRecord,
} from './order-tracking.repository.port'
import type { OrderTrackingNode } from '@prisma/client'

function toRecord(row: OrderTrackingNode): TrackingNodeRecord {
  return {
    id: row.id,
    orderLineId: row.orderLineId,
    sequence: row.sequence,
    processCode: row.processCode,
    node: row.node,
    phase: row.phase,
    department: row.department,
    status: row.status,
    qtyIn: row.qtyIn?.toString() ?? null,
    qtyOk: row.qtyOk?.toString() ?? null,
    qtyNg: row.qtyNg?.toString() ?? null,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    remark: row.remark,
  }
}

const toDecimal = (value: string | null | undefined): Prisma.Decimal | null =>
  value == null ? null : new Prisma.Decimal(value)

@Injectable()
export class PrismaOrderTrackingRepository implements OrderTrackingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByOrderLine(orderLineId: string): Promise<TrackingNodeRecord[]> {
    const rows = await this.prisma.orderTrackingNode.findMany({
      where: { orderLineId },
      orderBy: { sequence: 'asc' },
    })
    return rows.map(toRecord)
  }

  async listByOrder(orderId: string): Promise<Map<string, TrackingNodeRecord[]>> {
    const rows = await this.prisma.orderTrackingNode.findMany({
      where: { orderLine: { orderId } },
      orderBy: [{ orderLineId: 'asc' }, { sequence: 'asc' }],
    })

    const grouped = new Map<string, TrackingNodeRecord[]>()
    for (const row of rows) {
      const list = grouped.get(row.orderLineId) ?? []
      list.push(toRecord(row))
      grouped.set(row.orderLineId, list)
    }
    return grouped
  }

  async replaceNodes(
    orderLineId: string,
    nodes: TrackingNodeDraft[],
  ): Promise<TrackingNodeRecord[]> {
    await this.prisma.orderTrackingNode.deleteMany({ where: { orderLineId } })
    await this.prisma.orderTrackingNode.createMany({
      data: nodes.map((node) => ({
        orderLineId: node.orderLineId,
        sequence: node.sequence,
        processCode: node.processCode,
        node: node.node,
        phase: node.phase,
        department: node.department,
        status: node.status,
        qtyIn: toDecimal(node.qtyIn),
        qtyOk: toDecimal(node.qtyOk),
        qtyNg: toDecimal(node.qtyNg),
        startedAt: node.startedAt,
        finishedAt: node.finishedAt,
        remark: node.remark,
      })),
    })

    return this.listByOrderLine(orderLineId)
  }

  async findNode(orderLineId: string, sequence: number): Promise<TrackingNodeRecord | null> {
    const row = await this.prisma.orderTrackingNode.findUnique({
      where: { orderLineId_sequence: { orderLineId, sequence } },
    })
    return row ? toRecord(row) : null
  }

  async updateNode(
    id: string,
    patch: TrackingNodeProgressPatch,
  ): Promise<TrackingNodeRecord | null> {
    const row = await this.prisma.orderTrackingNode.update({
      where: { id },
      data: {
        status: patch.status,
        qtyIn: toDecimal(patch.qtyIn),
        qtyOk: toDecimal(patch.qtyOk),
        qtyNg: toDecimal(patch.qtyNg),
        startedAt: patch.startedAt,
        finishedAt: patch.finishedAt,
        remark: patch.remark,
      },
    })
    return toRecord(row)
  }
}
