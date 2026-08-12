import { captureErrorSource } from './error-source'

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
 *
 * 构造时**自动记下抛出点**（`source`）：错误码只说明这是哪一类错误，
 * 说不出是哪一行抛的。同一个码在仓库里往往有好几处抛出点，
 * 线上排障时那点差别就是全部差别。抛出点进日志；只有开发/测试环境才随响应下发。
 */
export class BizError extends Error {
  readonly code: string
  readonly status: number
  readonly captchaRequired?: boolean
  readonly details?: unknown
  /** 抛出点，形如 `modules/customs/services/customs-document.service.ts:87` */
  readonly source: string | null

  constructor(definition: BizErrorDefinition, options: BizErrorOptions = {}) {
    super(options.message ?? definition.message, { cause: options.cause })
    this.name = 'BizError'
    this.code = definition.code
    this.status = definition.status
    this.captchaRequired = options.captchaRequired
    this.details = options.details
    this.source = captureErrorSource(this.stack)
  }

  static is(value: unknown): value is BizError {
    return value instanceof BizError
  }
}
