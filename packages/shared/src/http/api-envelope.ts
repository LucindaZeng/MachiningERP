/** 统一响应包裹（api-conventions.md「请求约定」）。 */
export interface ApiEnvelope<T> {
  data: T
  meta?: ApiMeta
}

export interface ApiMeta {
  page?: number
  pageSize?: number
  total?: number
  [key: string]: unknown
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    traceId: string
    /** 登录场景专用：提示前端本次失败后必须出图形验证码 */
    captchaRequired?: boolean
    details?: unknown
  }
}
