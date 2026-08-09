/**
 * 业务错误：与后端 `{ error: { code, message, traceId } }` 一一对应。
 * 错误码分段见 docs/api/api-conventions.md（认证为 AUTH_1xxx）。
 */
export class BizError extends Error {
  readonly code: string
  readonly traceId: string
  readonly status: number
  /** 服务端要求补充图形验证码时为 true（AUTH_1003） */
  readonly captchaRequired: boolean

  constructor(params: {
    code: string
    message: string
    traceId?: string
    status?: number
    captchaRequired?: boolean
  }) {
    super(params.message)
    this.name = 'BizError'
    this.code = params.code
    this.traceId = params.traceId ?? ''
    this.status = params.status ?? 400
    this.captchaRequired = params.captchaRequired ?? false
  }
}

export function isBizError(error: unknown): error is BizError {
  return error instanceof BizError
}
