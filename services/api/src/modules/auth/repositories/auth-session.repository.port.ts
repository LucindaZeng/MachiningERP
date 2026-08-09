import type { LoginAudience } from '@prisma/client'

export interface CreateSessionInput {
  userId: string
  tokenId: string
  audience: LoginAudience
  expiresAt: Date
  ip: string | null
  userAgent: string | null
}

export interface SessionRecord {
  tokenId: string
  userId: string
  revokedAt: Date | null
  expiresAt: Date
}

export interface AuthSessionRepositoryPort {
  create(input: CreateSessionInput): Promise<void>
  findByTokenId(tokenId: string): Promise<SessionRecord | null>
  revoke(tokenId: string, at: Date): Promise<void>
}

export const AUTH_SESSION_REPOSITORY = Symbol('AUTH_SESSION_REPOSITORY')
