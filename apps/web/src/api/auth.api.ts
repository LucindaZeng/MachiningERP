import { request } from './http'

import type {
  AccountAvailability,
  AccountRequestInput,
  AccountRequestResult,
  CaptchaChallenge,
  LoginRequest,
  LoginResult,
} from '@/types/auth.types'

/** POST /auth/login —— 登录并签发 JWT */
export function login(payload: LoginRequest): Promise<LoginResult> {
  return request<LoginResult>({ method: 'POST', url: '/auth/login', body: payload })
}

/** POST /auth/logout —— 注销当前会话 */
export function logout(token: string): Promise<void> {
  return request<void>({ method: 'POST', url: '/auth/logout', token })
}

/** GET /auth/captcha —— 获取图形验证码挑战 */
export function fetchCaptcha(): Promise<CaptchaChallenge> {
  return request<CaptchaChallenge>({ method: 'GET', url: '/auth/captcha' })
}

/** POST /auth/account-availability —— 用户名唯一性校验（用户名为全公司唯一编码） */
export function checkAccountAvailability(account: string): Promise<AccountAvailability> {
  return request<AccountAvailability>({
    method: 'POST',
    url: '/auth/account-availability',
    body: { account },
  })
}

/** POST /auth/account-requests —— 提交账户申请，待信息部开通 */
export function submitAccountRequest(body: AccountRequestInput): Promise<AccountRequestResult> {
  return request<AccountRequestResult>({ method: 'POST', url: '/auth/account-requests', body })
}
