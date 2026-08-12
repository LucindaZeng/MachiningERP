import { SYSTEM_ERRORS, type ApiErrorBody } from '@machining-erp/shared'
import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'


import { traceIdOf } from '../http/trace-context'

import { BizError } from './biz-error'
import { captureErrorSource } from './error-source'

import type { Request, Response } from 'express'

interface NormalizedError {
  code: string
  status: number
  message: string
  captchaRequired?: boolean
  details?: unknown
  /** 抛出点；BizError 构造时自动捕获，其它异常靠栈首帧兜底 */
  source?: string | null
  stack?: string | undefined
}

/**
 * 抛出点与堆栈**只在非生产环境**随响应下发（development-guide 第 4 节）。
 * 生产环境它们仍然进日志——排障要得到，攻击者要不到。
 */
function exposesDiagnostics(): boolean {
  return process.env.NODE_ENV !== 'production'
}

/** 统一错误出口：所有异常都转成 api-conventions.md 约定的 `{ error: { code, message, traceId } }`。 */
@Catch()
export class BizExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(BizExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const response = http.getResponse<Response>()
    const request = http.getRequest<Request>()
    const traceId = traceIdOf(request)

    const normalized = this.normalize(exception)
    this.log(exception, normalized, traceId)

    const diagnostics =
      exposesDiagnostics()
        ? {
            ...(normalized.source ? { source: normalized.source } : {}),
            ...(normalized.stack ? { stack: normalized.stack } : {}),
          }
        : {}

    const body: ApiErrorBody = {
      error: {
        code: normalized.code,
        message: normalized.message,
        traceId,
        ...(normalized.captchaRequired === undefined
          ? {}
          : { captchaRequired: normalized.captchaRequired }),
        ...(normalized.details === undefined ? {} : { details: normalized.details }),
        ...diagnostics,
      },
    }

    response.status(normalized.status).json(body)
  }

  private normalize(exception: unknown): NormalizedError {
    if (BizError.is(exception)) {
      return {
        code: exception.code,
        status: exception.status,
        message: exception.message,
        captchaRequired: exception.captchaRequired,
        details: exception.details,
        source: exception.source,
        stack: exception.stack,
      }
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception)
    }

    // 非 BizError 的意外异常同样要能定位：栈首帧就是抛出点
    return {
      ...SYSTEM_ERRORS.UNKNOWN,
      source: exception instanceof Error ? captureErrorSource(exception.stack) : null,
      stack: exception instanceof Error ? exception.stack : undefined,
    }
  }

  private fromHttpException(exception: HttpException): NormalizedError {
    const status = exception.getStatus()
    const payload = exception.getResponse()
    const message =
      typeof payload === 'string'
        ? payload
        : ((payload as { message?: string | string[] }).message ?? exception.message)

    return {
      code: status === 404 ? SYSTEM_ERRORS.NOT_FOUND.code : SYSTEM_ERRORS.VALIDATION_FAILED.code,
      status,
      message: Array.isArray(message) ? message.join('；') : message,
      details: typeof payload === 'object' ? payload : undefined,
      source: captureErrorSource(exception.stack),
      stack: exception.stack,
    }
  }

  /**
   * 抛出点进**每一条**日志，而不只是 5xx 的那几条。
   * 4xx 才是排障时最难定位的一类——它不带堆栈，光有错误码根本分不清是哪处校验拦的。
   */
  private log(exception: unknown, normalized: NormalizedError, traceId: string): void {
    const at = normalized.source ? ` @ ${normalized.source}` : ''
    const line = `[${traceId}] ${normalized.code} ${normalized.message}${at}`
    if (normalized.status >= 500) {
      this.logger.error(line, exception instanceof Error ? exception.stack : String(exception))
      return
    }
    this.logger.warn(line)
  }
}
