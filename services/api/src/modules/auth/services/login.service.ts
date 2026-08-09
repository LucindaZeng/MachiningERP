import {
  AUTH_ERRORS,
  type LoginRequestContract,
  type LoginResultContract,
} from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { BizError } from '../../../common/errors/biz-error'
import { APP_CONFIG_KEY, type AppConfig } from '../../../config/app-config'
import { DOMAIN_EVENTS, DomainEventPublisher  } from '../../../platform/events'
import { PasswordService, UserDirectoryService } from '../../identity'
import { type UserRecord  } from '../../identity'
import {
  LOGIN_ATTEMPT_REPOSITORY,
  type LoginAttemptRepositoryPort,
} from '../repositories/login-attempt.repository.port'


import { AccessTokenService } from './access-token.service'
import { CaptchaService } from './captcha.service'
import {
  INITIAL_THROTTLE_STATE,
  applyFailure,
  describeFailure,
  evaluateThrottle,
  expireLockIfElapsed,
  type ThrottleConfig,
} from './login-throttle.policy'

import type { LoginAudience } from '@prisma/client'

export interface LoginContext {
  ip: string | null
  userAgent: string | null
  traceId?: string | null
}

/**
 * 登录用例编排：风控 → 图形验证码 → 账号状态 → 口令校验 → 签发会话。
 * 每一步的判定逻辑都在纯函数或独立 service 里，本类只负责编排顺序。
 */
@Injectable()
export class LoginService {
  constructor(
    private readonly config: ConfigService,
    private readonly captcha: CaptchaService,
    private readonly tokens: AccessTokenService,
    private readonly passwords: PasswordService,
    private readonly directory: UserDirectoryService,
    private readonly events: DomainEventPublisher,
    @Inject(LOGIN_ATTEMPT_REPOSITORY) private readonly attempts: LoginAttemptRepositoryPort,
  ) {}

  async login(
    input: LoginRequestContract,
    context: LoginContext,
    now: Date = new Date(),
  ): Promise<LoginResultContract> {
    const audience: LoginAudience = input.audience === 'portal' ? 'PORTAL' : 'INTERNAL'
    const account = input.account.trim().toLowerCase()
    const throttle = this.throttleConfig()

    const state = expireLockIfElapsed(
      (await this.attempts.find(audience, account)) ?? INITIAL_THROTTLE_STATE,
      now,
    )
    const decision = evaluateThrottle(state, throttle, now)

    if (decision.locked) {
      throw new BizError(AUTH_ERRORS.ACCOUNT_LOCKED, { captchaRequired: true })
    }
    if (decision.captchaRequired && !(await this.captcha.verify(input.captchaId, input.captchaCode, now))) {
      throw new BizError(AUTH_ERRORS.CAPTCHA_INVALID, { captchaRequired: true })
    }

    const user = await this.directory.findForLogin(audience, account)
    this.assertAccountUsable(user)

    if (!user || !(await this.passwords.verify(input.password, user.passwordHash))) {
      await this.recordFailure(audience, account, state, throttle, now, context)
      throw this.invalidCredentials(state.failureCount + 1, throttle)
    }

    return this.completeLogin(user, audience, account, context, now)
  }

  async logout(tokenId: string, now: Date = new Date()): Promise<void> {
    await this.tokens.revoke(tokenId, now)
  }

  /**
   * 离职账号一律停用：用户名虽已释放可被重新申请，但原账号本身不能再登录。
   * 未找到账号时不在此处报错，交由统一的「账号或密码不正确」处理，避免账号枚举。
   */
  private assertAccountUsable(user: UserRecord | null): void {
    if (!user) return

    if (user.employmentStatus === 'LEFT' || user.status === 'DISABLED') {
      throw new BizError(AUTH_ERRORS.ACCOUNT_DISABLED)
    }
  }

  private async completeLogin(
    user: UserRecord,
    audience: LoginAudience,
    account: string,
    context: LoginContext,
    now: Date,
  ): Promise<LoginResultContract> {
    await this.attempts.reset(audience, account)

    const issued = await this.tokens.issue(
      {
        userId: user.id,
        userCode: user.userCode,
        audience,
        displayName: user.displayName,
        department: user.departmentName ?? '',
        roles: user.roleCodes,
        permissions: user.permissionCodes,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      now,
    )

    await this.directory.touchLastLogin(user.id, now)
    await this.events.publish({
      name: DOMAIN_EVENTS.USER_LOGGED_IN,
      payload: { userCode: user.userCode, account, audience },
      traceId: context.traceId,
    })

    return {
      accessToken: issued.accessToken,
      expiresIn: issued.expiresIn,
      user: {
        id: user.id,
        userCode: user.userCode,
        account: user.account ?? account,
        displayName: user.displayName,
        department: user.departmentName ?? '',
        roles: user.roleCodes,
        permissions: user.permissionCodes,
      },
    }
  }

  private async recordFailure(
    audience: LoginAudience,
    account: string,
    state: Parameters<typeof applyFailure>[0],
    throttle: ThrottleConfig,
    now: Date,
    context: LoginContext,
  ): Promise<void> {
    const next = applyFailure(state, throttle, now)
    await this.attempts.save(audience, account, next)

    const eventName =
      next.lockedUntil === null ? DOMAIN_EVENTS.USER_LOGIN_FAILED : DOMAIN_EVENTS.USER_LOCKED

    await this.events.publish({
      name: eventName,
      payload: { account, audience, failureCount: next.failureCount, ip: context.ip },
      traceId: context.traceId,
    })
  }

  private invalidCredentials(failureCount: number, throttle: ThrottleConfig): BizError {
    return new BizError(AUTH_ERRORS.INVALID_CREDENTIALS, {
      message: describeFailure(failureCount, throttle),
      captchaRequired: failureCount >= throttle.captchaThreshold,
    })
  }

  private throttleConfig(): ThrottleConfig {
    const auth = this.config.getOrThrow<AppConfig>(APP_CONFIG_KEY).auth
    return {
      captchaThreshold: auth.captchaThreshold,
      lockThreshold: auth.lockThreshold,
      lockMinutes: auth.lockMinutes,
    }
  }
}
