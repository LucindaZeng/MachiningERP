import type { LoginAudience } from '@prisma/client'

/** 登录失败计数的持久化形状。判定逻辑在 services/login-throttle.policy.ts。 */
export interface ThrottleState {
  failureCount: number
  lockedUntil: Date | null
}

export interface LoginAttemptRepositoryPort {
  find(audience: LoginAudience, account: string): Promise<ThrottleState | null>
  save(audience: LoginAudience, account: string, state: ThrottleState): Promise<void>
  reset(audience: LoginAudience, account: string): Promise<void>
}

export const LOGIN_ATTEMPT_REPOSITORY = Symbol('LOGIN_ATTEMPT_REPOSITORY')
