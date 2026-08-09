import { Injectable } from '@nestjs/common'


import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  AccountRequestRecord,
  AccountRequestRepositoryPort,
  CreateAccountRequestInput,
  DecideAccountRequestInput,
} from './account-request.repository.port'
import type { RequestStatus } from '@prisma/client'

@Injectable()
export class PrismaAccountRequestRepository implements AccountRequestRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async hasPending(account: string): Promise<boolean> {
    const count = await this.prisma.accountRequest.count({
      where: { account, status: 'SUBMITTED' },
    })
    return count > 0
  }

  findById(id: string): Promise<AccountRequestRecord | null> {
    return this.prisma.accountRequest.findUnique({ where: { id } })
  }

  create(input: CreateAccountRequestInput): Promise<AccountRequestRecord> {
    return this.prisma.accountRequest.create({ data: { ...input } })
  }

  listByStatus(status: RequestStatus, limit: number): Promise<AccountRequestRecord[]> {
    return this.prisma.accountRequest.findMany({
      where: { status },
      orderBy: { submittedAt: 'asc' },
      take: limit,
    })
  }

  async decide(input: DecideAccountRequestInput): Promise<boolean> {
    const result = await this.prisma.accountRequest.updateMany({
      where: { id: input.id, version: input.version, status: 'SUBMITTED' },
      data: {
        status: input.status,
        decidedBy: input.decidedBy,
        decidedAt: input.decidedAt,
        rejectReason: input.rejectReason,
        approvedUser: input.approvedUserId,
        version: { increment: 1 },
      },
    })
    return result.count === 1
  }
}
