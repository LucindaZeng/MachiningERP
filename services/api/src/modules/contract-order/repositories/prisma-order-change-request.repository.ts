import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreateOrderChangeRequestData,
  HandleOrderChangeData,
  OrderChangeRequestRecord,
  OrderChangeRequestRepositoryPort,
} from './order-change-request.repository.port'
import type { OrderChangeRequest } from '@prisma/client'

function toRecord(row: OrderChangeRequest): OrderChangeRequestRecord {
  return {
    id: row.id,
    requestNo: row.requestNo,
    orderId: row.orderId,
    orderLineId: row.orderLineId,
    changeType: row.changeType,
    origin: row.origin,
    urgent: row.urgent,
    beforeValue: row.beforeValue,
    afterValue: row.afterValue,
    reason: row.reason,
    costOwner: row.costOwner,
    status: row.status,
    submittedBy: row.submittedBy,
    submittedAt: row.submittedAt,
    handledBy: row.handledBy,
    handledAt: row.handledAt,
    rejectReason: row.rejectReason,
    versionLock: row.versionLock,
  }
}

@Injectable()
export class PrismaOrderChangeRequestRepository implements OrderChangeRequestRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<OrderChangeRequestRecord | null> {
    const row = await this.prisma.orderChangeRequest.findUnique({ where: { id } })
    return row ? toRecord(row) : null
  }

  async listByOrder(orderId: string): Promise<OrderChangeRequestRecord[]> {
    const rows = await this.prisma.orderChangeRequest.findMany({
      where: { orderId },
      orderBy: { submittedAt: 'desc' },
    })
    return rows.map(toRecord)
  }

  async create(data: CreateOrderChangeRequestData): Promise<OrderChangeRequestRecord> {
    const row = await this.prisma.orderChangeRequest.create({ data })
    return toRecord(row)
  }

  /** 只有仍是 SUBMITTED 且版本匹配才落地，杜绝重复处理。 */
  async handle(
    id: string,
    versionLock: number,
    data: HandleOrderChangeData,
  ): Promise<OrderChangeRequestRecord | null> {
    const updated = await this.prisma.orderChangeRequest.updateMany({
      where: { id, versionLock, status: { in: ['SUBMITTED', 'REVIEWING'] } },
      data: {
        status: data.status,
        handledBy: data.handledBy,
        handledAt: data.handledAt,
        rejectReason: data.rejectReason ?? null,
        versionLock: { increment: 1 },
      },
    })
    if (updated.count !== 1) return null

    return this.findById(id)
  }
}
