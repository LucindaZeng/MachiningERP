import type { LoginAudience, LoginRequest } from '@/types/auth.types'

export interface LoginFormModel {
  audience: LoginAudience
  account: string
  password: string
  captchaCode: string
  remember: boolean
}

/** 登录表单初始状态：默认停在内部员工入口（ADR-0004 内外账号分域） */
export function createLoginFormState(): LoginFormModel {
  return {
    audience: 'internal',
    account: '',
    password: '',
    captchaCode: '',
    remember: false,
  }
}

/**
 * 切换登录入口时清空凭据：内外账号是两套体系，
 * 沿用上一个入口输入的密码/验证码只会换来一次必然失败的登录，反而累计风控计数。
 */
export function switchFormAudience(form: LoginFormModel, audience: LoginAudience): void {
  form.audience = audience
  form.password = ''
  form.captchaCode = ''
}

/**
 * 表单 → 登录请求体。
 * 账号两侧的空格是粘贴工号时的常见噪声，统一在出口 trim；密码原样提交，不做任何加工。
 */
export function toLoginRequest(
  form: LoginFormModel,
  captcha: Pick<LoginRequest, 'captchaId' | 'captchaCode'>,
): LoginRequest {
  return {
    audience: form.audience,
    account: form.account.trim(),
    password: form.password,
    ...captcha,
  }
}
