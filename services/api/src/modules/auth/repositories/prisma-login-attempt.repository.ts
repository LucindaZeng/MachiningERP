import { Injectable } from '@nestjs/common'


import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type { LoginAttemptRepositoryPort, ThrottleState } from './login-attempt.repository.port'
import type { LoginAudience } from '@prisma/client'

@Injectable()
export class PrismaLoginAttemptRepository implements LoginAttemptRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async find(audience: LoginAudience, account: string): Promise<ThrottleState | null> {
    const row = await this.prisma.loginAttempt.findUnique({
      where: { audience_account: { audience, account } },
      select: { failureCount: true, lockedUntil: true },
    })
    return row ? { failureCount: row.failureCount, lockedUntil: row.lockedUntil } : null
  }

  async save(audience: LoginAudience, account: string, state: ThrottleState): Promise<void> {
    await this.prisma.loginAttempt.upsert({
      where: { audience_account: { audience, account } },
      create: {
        audience,
        account,
        failureCount: state.failureCount,
        lockedUntil: state.lockedUntil,
        lastFailedAt: new Date(),
      },
      update: {
        failureCount: state.failureCount,
        lockedUntil: state.lockedUntil,
        lastFailedAt: new Date(),
      },
    })
  }

  async reset(audience: LoginAudience, account: string): Promise<void> {
    await this.prisma.loginAttempt.deleteMany({ where: { audience, account } })
  }
}
