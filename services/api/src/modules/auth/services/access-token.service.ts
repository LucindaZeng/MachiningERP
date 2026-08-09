import { randomUUID } from 'node:crypto'

import { AUTH_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import { BizError } from '../../../common/errors/biz-error'
import { APP_CONFIG_KEY, type AppConfig } from '../../../config/app-config'
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepositoryPort,
} from '../repositories/auth-session.repository.port'

import { parseDurationSeconds } from './token-duration'


import type { LoginAudience } from '@prisma/client'

export interface AccessTokenClaims {
  /** 主体一律是唯一编码，不是用户名 */
  sub: string
  uid: string
  aud: LoginAudience
  name: string
  dept: string
  roles: string[]
  perms: string[]
  jti: string
}

export interface IssuedToken {
  accessToken: string
  expiresIn: number
  tokenId: string
  expiresAt: Date
}

export interface IssueTokenInput {
  userId: string
  userCode: string
  audience: LoginAudience
  displayName: string
  department: string
  roles: string[]
  permissions: string[]
  ip: string | null
  userAgent: string | null
}

/** JWT 签发与校验；注销后 token 立即失效（服务端会话表 revokedAt）。 */
@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(AUTH_SESSION_REPOSITORY) private readonly sessions: AuthSessionRepositoryPort,
  ) {}

  async issue(input: IssueTokenInput, now: Date = new Date()): Promise<IssuedToken> {
    const auth = this.config.getOrThrow<AppConfig>(APP_CONFIG_KEY).auth
    const expiresIn = parseDurationSeconds(auth.jwtExpiresIn)
    const tokenId = randomUUID()
    const expiresAt = new Date(now.getTime() + expiresIn * 1000)

    const claims: AccessTokenClaims = {
      sub: input.userCode,
      uid: input.userId,
      aud: input.audience,
      name: input.displayName,
      dept: input.department,
      roles: input.roles,
      perms: input.permissions,
      jti: tokenId,
    }

    const accessToken = await this.jwt.signAsync(claims, { secret: auth.jwtSecret, expiresIn })

    await this.sessions.create({
      userId: input.userId,
      tokenId,
      audience: input.audience,
      expiresAt,
      ip: input.ip,
      userAgent: input.userAgent,
    })

    return { accessToken, expiresIn, tokenId, expiresAt }
  }

  async verify(token: string, now: Date = new Date()): Promise<AccessTokenClaims> {
    const auth = this.config.getOrThrow<AppConfig>(APP_CONFIG_KEY).auth

    const claims = await this.jwt
      .verifyAsync<AccessTokenClaims>(token, { secret: auth.jwtSecret })
      .catch(() => {
        throw new BizError(AUTH_ERRORS.TOKEN_INVALID)
      })

    const session = await this.sessions.findByTokenId(claims.jti)
    if (!session || session.revokedAt !== null || session.expiresAt.getTime() <= now.getTime()) {
      throw new BizError(AUTH_ERRORS.TOKEN_INVALID, { message: '会话已注销或已过期，请重新登录' })
    }

    return claims
  }

  revoke(tokenId: string, now: Date = new Date()): Promise<void> {
    return this.sessions.revoke(tokenId, now)
  }
}
