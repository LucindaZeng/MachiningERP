import { request } from './http'
import type { PasswordResetRequestInput, PasswordResetRequestResult } from '@/types/auth.types'

/**
 * POST /auth/password-reset-requests
 * 提交密码重置申请，由 IT/系统管理员在 identity 模块后台核实身份后重置并线下通知。
 */
export function submitPasswordResetRequest(
  payload: PasswordResetRequestInput,
): Promise<PasswordResetRequestResult> {
  return request<PasswordResetRequestResult>({
    method: 'POST',
    url: '/auth/password-reset-requests',
    body: payload,
    idempotencyKey: `pwd-reset-${payload.account}-${Date.now()}`,
  })
}
