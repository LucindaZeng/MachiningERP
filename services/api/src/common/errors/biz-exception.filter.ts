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

import type { Request, Response } from 'express'

interface NormalizedError {
  code: string
  status: number
  message: string
  captchaRequired?: boolean
  details?: unknown
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

    const body: ApiErrorBody = {
      error: {
        code: normalized.code,
        message: normalized.message,
        traceId,
        ...(normalized.captchaRequired === undefined
          ? {}
          : { captchaRequired: normalized.captchaRequired }),
        ...(normalized.details === undefined ? {} : { details: normalized.details }),
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
      }
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception)
    }

    return { ...SYSTEM_ERRORS.UNKNOWN }
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
    }
  }

  private log(exception: unknown, normalized: NormalizedError, traceId: string): void {
    const line = `[${traceId}] ${normalized.code} ${normalized.message}`
    if (normalized.status >= 500) {
      this.logger.error(line, exception instanceof Error ? exception.stack : String(exception))
      return
    }
    this.logger.warn(line)
  }
}
