import { isBizError } from '@/api/biz-error'

/**
 * 认证相关的兜底文案。
 * 业务错误（AUTH_1xxx）的文案由服务端下发，这里只收口「拿不到业务错误码」时的提示，
 * 集中放置是为了让登录、账户申请两条链路的措辞保持一致。
 */
export const AUTH_MESSAGES = {
  /** 登录接口不可达（网络中断、5xx）时的兜底提示 */
  loginUnavailable: '登录服务暂不可用，请稍后重试',
  /** 账户申请提交失败的兜底提示 */
  accountRequestFailed: '提交失败，请稍后重试',
  /** 前端本地校验未过：不发请求，直接提示用户补齐 */
  accountRequestIncomplete: '请先补齐必填项，并确认用户名可用、两次密码一致',
} as const

/**
 * 错误码到文案的映射。
 * 后端 BizError 已按 docs/api/api-conventions.md 给出面向用户的中文 message，直接透传，
 * 避免前端维护一份会漂移的错误码字典；非业务异常才落到调用方给的兜底文案。
 */
export function resolveAuthErrorMessage(error: unknown, fallback: string): string {
  return isBizError(error) ? error.message : fallback
}
