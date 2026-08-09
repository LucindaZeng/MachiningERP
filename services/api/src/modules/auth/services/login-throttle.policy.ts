import type { ThrottleState } from '../repositories/login-attempt.repository.port'

export interface ThrottleConfig {
  /** 连续失败达到该次数后强制图形验证码 */
  captchaThreshold: number
  /** 连续失败达到该次数后临时锁定 */
  lockThreshold: number
  lockMinutes: number
}

export interface ThrottleDecision {
  locked: boolean
  captchaRequired: boolean
  /** 距离临时锁定还剩几次机会 */
  remainingAttempts: number
}

export type { ThrottleState }

export const INITIAL_THROTTLE_STATE: ThrottleState = { failureCount: 0, lockedUntil: null }

/**
 * 登录风控判定（业务规格「3 次密码错误后强制图形验证码」）。
 * 纯函数：不碰数据库、不碰时钟，now 由调用方注入，便于把每条分支都测到。
 */
export function evaluateThrottle(
  state: ThrottleState,
  config: ThrottleConfig,
  now: Date,
): ThrottleDecision {
  const lockedByWindow = state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime()
  const lockedByCount = state.failureCount >= config.lockThreshold && state.lockedUntil === null

  return {
    locked: lockedByWindow || lockedByCount,
    captchaRequired: state.failureCount >= config.captchaThreshold,
    remainingAttempts: Math.max(config.lockThreshold - state.failureCount, 0),
  }
}

/** 锁定窗口已过：计数清零重新开始，避免用户永久被锁。 */
export function expireLockIfElapsed(state: ThrottleState, now: Date): ThrottleState {
  if (state.lockedUntil !== null && state.lockedUntil.getTime() <= now.getTime()) {
    return { ...INITIAL_THROTTLE_STATE }
  }
  return state
}

export function applyFailure(
  state: ThrottleState,
  config: ThrottleConfig,
  now: Date,
): ThrottleState {
  const failureCount = state.failureCount + 1
  const shouldLock = failureCount >= config.lockThreshold

  return {
    failureCount,
    lockedUntil: shouldLock ? new Date(now.getTime() + config.lockMinutes * 60_000) : null,
  }
}

/** 失败提示：达到验证码阈值后额外告知剩余尝试次数，与前端 mock 文案一致。 */
export function describeFailure(failureCount: number, config: ThrottleConfig): string {
  if (failureCount < config.captchaThreshold) {
    return '账号或密码不正确'
  }

  const remaining = Math.max(config.lockThreshold - failureCount, 0)
  return `账号或密码不正确，还可尝试 ${remaining} 次`
}
