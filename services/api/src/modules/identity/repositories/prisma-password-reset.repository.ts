import { Injectable } from '@nestjs/common'


import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreatePasswordResetInput,
  PasswordResetRecord,
  PasswordResetRepositoryPort,
} from './password-reset.repository.port'
import type { LoginAudience } from '@prisma/client'

@Injectable()
export class PrismaPasswordResetRepository implements PasswordResetRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async hasPending(audience: LoginAudience, account: string): Promise<boolean> {
    const count = await this.prisma.passwordResetRequest.count({
      where: { audience, account, status: 'SUBMITTED' },
    })
    return count > 0
  }

  create(input: CreatePasswordResetInput): Promise<PasswordResetRecord> {
    return this.prisma.passwordResetRequest.create({ data: { ...input } })
  }

  listPending(limit: number): Promise<PasswordResetRecord[]> {
    return this.prisma.passwordResetRequest.findMany({
      where: { status: 'SUBMITTED' },
      orderBy: { submittedAt: 'asc' },
      take: limit,
    })
  }
}
