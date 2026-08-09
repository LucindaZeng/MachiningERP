import { Injectable } from '@nestjs/common'
import { Prisma, type RequestStatus } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreateChangeRequestData,
  CustomerChangeRequestRecord,
  CustomerChangeRequestRepositoryPort,
  DecideChangeRequestData,
  FieldChange,
} from './customer-change-request.repository.port'

type Row = {
  id: string
  requestNo: string
  customerId: string
  changes: Prisma.JsonValue
  reason: string
  status: RequestStatus
  submittedBy: string
  submittedAt: Date
  decidedBy: string | null
  decidedAt: Date | null
  rejectReason: string | null
  version: number
}

function toRecord(row: Row): CustomerChangeRequestRecord {
  return { ...row, changes: (row.changes ?? []) as unknown as FieldChange[] }
}

@Injectable()
export class PrismaCustomerChangeRequestRepository implements CustomerChangeRequestRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<CustomerChangeRequestRecord | null> {
    const row = await this.prisma.customerChangeRequest.findUnique({ where: { id } })
    return row ? toRecord(row) : null
  }

  async listByCustomer(
    customerId: string,
    status?: RequestStatus,
  ): Promise<CustomerChangeRequestRecord[]> {
    const rows = await this.prisma.customerChangeRequest.findMany({
      where: { customerId, ...(status ? { status } : {}) },
      orderBy: { submittedAt: 'desc' },
    })
    return rows.map(toRecord)
  }

  async create(data: CreateChangeRequestData): Promise<CustomerChangeRequestRecord> {
    const row = await this.prisma.customerChangeRequest.create({
      data: {
        requestNo: data.requestNo,
        customerId: data.customerId,
        changes: data.changes as unknown as Prisma.InputJsonValue,
        reason: data.reason,
        submittedBy: data.submittedBy,
      },
    })
    return toRecord(row)
  }

  async decide(data: DecideChangeRequestData): Promise<boolean> {
    const result = await this.prisma.customerChangeRequest.updateMany({
      where: { id: data.id, version: data.version, status: 'SUBMITTED' },
      data: {
        status: data.status,
        decidedBy: data.decidedBy,
        decidedAt: data.decidedAt,
        rejectReason: data.rejectReason,
        version: { increment: 1 },
      },
    })
    return result.count === 1
  }
}
