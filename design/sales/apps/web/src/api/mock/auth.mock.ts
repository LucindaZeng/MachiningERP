import { BizError } from '../biz-error'
import { issueCaptcha, verifyCaptcha } from './captcha-store'
import { findMockAccount } from './mock-accounts'
import type { CaptchaChallenge, LoginRequest, LoginResult } from '@/types/auth.types'

/** 连续失败达到该次数后强制图形验证码（生产由 auth 模块按 IP+账号维度控制） */
export const CAPTCHA_THRESHOLD = 3
const LOCK_THRESHOLD = 8

const failedAttempts = new Map<string, number>()

export function mockIssueCaptcha(): CaptchaChallenge {
  return issueCaptcha()
}

export function mockLogin(payload: LoginRequest): LoginResult {
  const key = `${payload.audience}:${payload.account.trim().toLowerCase()}`
  const failures = failedAttempts.get(key) ?? 0

  assertNotLocked(failures)
  assertCaptcha(failures, payload)

  const matched = findMockAccount(payload.audience, payload.account)

  // 离职账号一律停用：用户名虽已释放可被重新申请，但原账号本身不能再登录
  if (matched?.employment === 'left') {
    throw new BizError({
      code: 'AUTH_1030',
      message: '该账号持有人已离职，账号已停用；用户名已释放，可由新员工重新申请',
      status: 403,
    })
  }

  if (!matched || matched.password !== payload.password) {
    const next = failures + 1
    failedAttempts.set(key, next)
    throw invalidCredentials(next)
  }

  failedAttempts.delete(key)
  return buildSession(matched.user)
}

export function mockLogout(): void {
  // mock 无服务端会话，留空即可
}

function assertNotLocked(failures: number): void {
  if (failures < LOCK_THRESHOLD) {
    return
  }
  throw new BizError({
    code: 'AUTH_1005',
    message: '账号已被临时锁定，请 30 分钟后重试或联系 IT 管理员解锁',
    status: 423,
    captchaRequired: true,
  })
}

function assertCaptcha(failures: number, payload: LoginRequest): void {
  if (failures < CAPTCHA_THRESHOLD) {
    return
  }
  if (!verifyCaptcha(payload.captchaId, payload.captchaCode)) {
    throw new BizError({
      code: 'AUTH_1003',
      message: '图形验证码错误或已过期，请重新输入',
      status: 400,
      captchaRequired: true,
    })
  }
}

function invalidCredentials(failures: number): BizError {
  const remaining = Math.max(LOCK_THRESHOLD - failures, 0)
  const suffix = failures >= CAPTCHA_THRESHOLD ? `，还可尝试 ${remaining} 次` : ''

  return new BizError({
    code: 'AUTH_1001',
    message: `账号或密码不正确${suffix}`,
    status: 401,
    captchaRequired: failures >= CAPTCHA_THRESHOLD,
  })
}

function buildSession(user: LoginResult['user']): LoginResult {
  return {
    accessToken: `mock.${btoa(unescape(encodeURIComponent(user.id)))}.${Date.now().toString(36)}`,
    expiresIn: 8 * 60 * 60,
    user,
  }
}
