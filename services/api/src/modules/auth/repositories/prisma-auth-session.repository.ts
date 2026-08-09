import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  AuthSessionRepositoryPort,
  CreateSessionInput,
  SessionRecord,
} from './auth-session.repository.port'


@Injectable()
export class PrismaAuthSessionRepository implements AuthSessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSessionInput): Promise<void> {
    await this.prisma.authSession.create({ data: { ...input } })
  }

  findByTokenId(tokenId: string): Promise<SessionRecord | null> {
    return this.prisma.authSession.findUnique({
      where: { tokenId },
      select: { tokenId: true, userId: true, revokedAt: true, expiresAt: true },
    })
  }

  async revoke(tokenId: string, at: Date): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { tokenId, revokedAt: null },
      data: { revokedAt: at },
    })
  }
}
