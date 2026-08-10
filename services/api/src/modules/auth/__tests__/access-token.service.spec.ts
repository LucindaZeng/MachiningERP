import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import { BizError } from '../../../common/errors/biz-error'
import { loadAppConfig } from '../../../config/app-config'
import { AccessTokenService } from '../services/access-token.service'

import type {
  AuthSessionRepositoryPort,
  CreateSessionInput,
  SessionRecord,
} from '../repositories/auth-session.repository.port'

class FakeSessions implements AuthSessionRepositoryPort {
  readonly rows = new Map<string, SessionRecord>()

  async create(input: CreateSessionInput): Promise<void> {
    this.rows.set(input.tokenId, {
      tokenId: input.tokenId,
      userId: input.userId,
      revokedAt: null,
      expiresAt: input.expiresAt,
    })
  }

  async findByTokenId(tokenId: string): Promise<SessionRecord | null> {
    return this.rows.get(tokenId) ?? null
  }

  async revoke(tokenId: string, at: Date): Promise<void> {
    const row = this.rows.get(tokenId)
    if (row) row.revokedAt = at
  }
}

const NOW = new Date('2026-08-08T10:00:00Z')

const INPUT = {
  userId: 'user-1',
  userCode: 'WFX-2018-0042',
  audience: 'INTERNAL' as const,
  displayName: '罗晓琳',
  department: '业务部',
  roles: ['SALES_MANAGER'],
  permissions: ['quote.approve'],
  ip: '10.0.0.1',
  userAgent: 'jest',
}

function build(): { service: AccessTokenService; sessions: FakeSessions } {
  const sessions = new FakeSessions()
  const config = {
    getOrThrow: () =>
      loadAppConfig({ JWT_SECRET: 'test-secret-at-least-32-characters-long', JWT_EXPIRES_IN: '8h' } as NodeJS.ProcessEnv),
  } as unknown as ConfigService

  return { service: new AccessTokenService(new JwtService(), config, sessions), sessions }
}

describe('JWT 签发与校验', () => {
  it('签发的 token 主体是唯一编码，且带权限点', async () => {
    const { service } = build()
    const issued = await service.issue(INPUT, NOW)

    expect(issued.expiresIn).toBe(28800)
    const claims = await service.verify(issued.accessToken, NOW)
    expect(claims.sub).toBe('WFX-2018-0042')
    expect(claims.uid).toBe('user-1')
    expect(claims.perms).toEqual(['quote.approve'])
  })

  it('注销后 token 立即失效', async () => {
    const { service } = build()
    const issued = await service.issue(INPUT, NOW)
    await service.revoke(issued.tokenId, NOW)

    await expect(service.verify(issued.accessToken, NOW)).rejects.toBeInstanceOf(BizError)
  })

  it('会话过期后校验失败', async () => {
    const { service } = build()
    const issued = await service.issue(INPUT, NOW)
    const later = new Date(NOW.getTime() + 28_801_000)

    await expect(service.verify(issued.accessToken, later)).rejects.toThrow(/会话已注销或已过期/)
  })

  it('会话记录缺失（如数据库被清）时拒绝', async () => {
    const { service, sessions } = build()
    const issued = await service.issue(INPUT, NOW)
    sessions.rows.delete(issued.tokenId)

    await expect(service.verify(issued.accessToken, NOW)).rejects.toBeInstanceOf(BizError)
  })

  it('伪造或损坏的 token 抛 AUTH_1006', async () => {
    const { service } = build()
    await expect(service.verify('not-a-jwt', NOW)).rejects.toMatchObject({ code: 'AUTH_1006' })
  })
})

describe('默认取当前时间', () => {
  it('issue / verify / revoke 不传 now 时使用系统时钟', async () => {
    const { service } = build()
    const issued = await service.issue(INPUT)

    const claims = await service.verify(issued.accessToken)
    expect(claims.jti).toBe(issued.tokenId)

    await service.revoke(issued.tokenId)
    await expect(service.verify(issued.accessToken)).rejects.toBeInstanceOf(BizError)
  })
})
