import type { BizErrorDefinition } from '@machining-erp/shared'

export interface BizErrorOptions {
  /** 覆盖字典里的默认文案，用于补充「缺失项清单」这类动态信息 */
  message?: string
  /** 登录场景：提示前端本次失败后必须出图形验证码 */
  captchaRequired?: boolean
  /** 结构化细节，例如下单校验缺失的报价/成本分析/工程资料清单 */
  details?: unknown
  cause?: unknown
}

/**
 * 业务错误的唯一载体（development-guide 第 4 节「业务错误抛 BizError(code)」）。
 * 禁止吞异常，也禁止直接抛字符串或 HttpException。
 */
export class BizError extends Error {
  readonly code: string
  readonly status: number
  readonly captchaRequired?: boolean
  readonly details?: unknown

  constructor(definition: BizErrorDefinition, options: BizErrorOptions = {}) {
    super(options.message ?? definition.message, { cause: options.cause })
    this.name = 'BizError'
    this.code = definition.code
    this.status = definition.status
    this.captchaRequired = options.captchaRequired
    this.details = options.details
  }

  static is(value: unknown): value is BizError {
    return value instanceof BizError
  }
}
