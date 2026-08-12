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
    /** 一律中文——面向使用者的文案（development-guide 第 4 节） */
    message: string
    traceId: string
    /** 登录场景专用：提示前端本次失败后必须出图形验证码 */
    captchaRequired?: boolean
    details?: unknown
    /**
     * 抛出点，形如 `modules/customs/services/customs-document.service.ts:87`。
     *
     * **只在开发/测试环境下发**：生产环境把它留在服务端日志里。
     * 同一个错误码常常有好几处抛出点（`LINES_REQUIRED` 就有五处），
     * 光有 code 定位不到是哪一处——这正是第 4 节「可追溯到哪个文件抛了什么」要的东西。
     */
    source?: string
    /** 同上，只在开发/测试环境下发 */
    stack?: string
  }
}
