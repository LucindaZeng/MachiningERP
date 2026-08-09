import {
  INITIAL_THROTTLE_STATE,
  applyFailure,
  describeFailure,
  evaluateThrottle,
  expireLockIfElapsed,
  type ThrottleConfig,
} from '../services/login-throttle.policy'

const CONFIG: ThrottleConfig = { captchaThreshold: 3, lockThreshold: 8, lockMinutes: 30 }
const NOW = new Date('2026-08-08T10:00:00Z')

describe('登录风控判定', () => {
  it('失败少于 3 次：不出验证码、不锁定', () => {
    for (const failureCount of [0, 1, 2]) {
      const decision = evaluateThrottle({ failureCount, lockedUntil: null }, CONFIG, NOW)
      expect(decision).toEqual({ locked: false, captchaRequired: false, remainingAttempts: 8 - failureCount })
    }
  })

  it('失败满 3 次：强制图形验证码（业务规格硬性要求）', () => {
    const decision = evaluateThrottle({ failureCount: 3, lockedUntil: null }, CONFIG, NOW)
    expect(decision.captchaRequired).toBe(true)
    expect(decision.locked).toBe(false)
    expect(decision.remainingAttempts).toBe(5)
  })

  it('失败满 8 次：即使还没写入锁定窗口也判定为锁定', () => {
    const decision = evaluateThrottle({ failureCount: 8, lockedUntil: null }, CONFIG, NOW)
    expect(decision.locked).toBe(true)
    expect(decision.remainingAttempts).toBe(0)
  })

  it('锁定窗口内一律锁定', () => {
    const lockedUntil = new Date(NOW.getTime() + 60_000)
    expect(evaluateThrottle({ failureCount: 8, lockedUntil }, CONFIG, NOW).locked).toBe(true)
  })

  it('锁定窗口已过则不再锁定', () => {
    const lockedUntil = new Date(NOW.getTime() - 1)
    expect(evaluateThrottle({ failureCount: 8, lockedUntil }, CONFIG, NOW).locked).toBe(false)
  })

  it('剩余次数不会为负', () => {
    expect(evaluateThrottle({ failureCount: 20, lockedUntil: null }, CONFIG, NOW).remainingAttempts).toBe(0)
  })
})

describe('锁定过期后计数清零', () => {
  it('窗口已过：状态重置，用户可以重新尝试', () => {
    const state = { failureCount: 8, lockedUntil: new Date(NOW.getTime() - 1000) }
    expect(expireLockIfElapsed(state, NOW)).toEqual(INITIAL_THROTTLE_STATE)
  })

  it('窗口未到：状态原样保留', () => {
    const state = { failureCount: 8, lockedUntil: new Date(NOW.getTime() + 1000) }
    expect(expireLockIfElapsed(state, NOW)).toBe(state)
  })

  it('从未锁定过：状态原样保留', () => {
    const state = { failureCount: 2, lockedUntil: null }
    expect(expireLockIfElapsed(state, NOW)).toBe(state)
  })
})

describe('失败后的状态推进', () => {
  it('未达锁定阈值只累加计数', () => {
    expect(applyFailure({ failureCount: 2, lockedUntil: null }, CONFIG, NOW)).toEqual({
      failureCount: 3,
      lockedUntil: null,
    })
  })

  it('达到锁定阈值时写入锁定截止时间', () => {
    const next = applyFailure({ failureCount: 7, lockedUntil: null }, CONFIG, NOW)
    expect(next.failureCount).toBe(8)
    expect(next.lockedUntil).toEqual(new Date(NOW.getTime() + 30 * 60_000))
  })
})

describe('失败提示文案', () => {
  it('未到验证码阈值不暴露剩余次数', () => {
    expect(describeFailure(1, CONFIG)).toBe('账号或密码不正确')
  })

  it('到达验证码阈值后告知剩余次数', () => {
    expect(describeFailure(3, CONFIG)).toBe('账号或密码不正确，还可尝试 5 次')
    expect(describeFailure(8, CONFIG)).toBe('账号或密码不正确，还可尝试 0 次')
    expect(describeFailure(99, CONFIG)).toBe('账号或密码不正确，还可尝试 0 次')
  })
})
