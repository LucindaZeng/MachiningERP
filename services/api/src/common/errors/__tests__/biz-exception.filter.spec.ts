import { AUTH_ERRORS, SYSTEM_ERRORS, type ApiErrorBody } from '@machining-erp/shared'
import { HttpException, HttpStatus, Logger, NotFoundException, type ArgumentsHost } from '@nestjs/common'

import { BizError } from '../biz-error'
import { BizExceptionFilter } from '../biz-exception.filter'

interface Captured {
  status: number
  body: ApiErrorBody
}

function buildHost(): { host: ArgumentsHost; captured: Captured } {
  const captured: Captured = { status: 0, body: { error: { code: '', message: '', traceId: '' } } }
  const response = {
    status(code: number) {
      captured.status = code
      return this
    },
    json(body: ApiErrorBody) {
      captured.body = body
    },
  }

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ traceId: 'trace-1' }),
    }),
  } as unknown as ArgumentsHost

  return { host, captured }
}

describe('统一错误出口', () => {
  let warnSpy: jest.SpyInstance
  let errorSpy: jest.SpyInstance

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('BizError 原样输出 code / status / traceId', () => {
    const { host, captured } = buildHost()
    new BizExceptionFilter().catch(new BizError(AUTH_ERRORS.INVALID_CREDENTIALS), host)

    expect(captured.status).toBe(401)
    expect(captured.body.error).toMatchObject({ code: 'AUTH_1001', traceId: 'trace-1' })
    expect(warnSpy).toHaveBeenCalled()
  })

  it('登录场景透出 captchaRequired 与 details', () => {
    const { host, captured } = buildHost()
    new BizExceptionFilter().catch(
      new BizError(AUTH_ERRORS.CAPTCHA_INVALID, { captchaRequired: true, details: { missing: ['captcha'] } }),
      host,
    )

    expect(captured.body.error.captchaRequired).toBe(true)
    expect(captured.body.error.details).toEqual({ missing: ['captcha'] })
  })

  it('未设置的可选字段不会出现在响应里', () => {
    const { host, captured } = buildHost()
    new BizExceptionFilter().catch(new BizError(AUTH_ERRORS.FORBIDDEN), host)

    expect('captchaRequired' in captured.body.error).toBe(false)
    expect('details' in captured.body.error).toBe(false)
  })

  it('NestJS 校验异常映射成 SYS_9001', () => {
    const { host, captured } = buildHost()
    new BizExceptionFilter().catch(
      new HttpException({ message: ['account 必填', 'password 必填'] }, HttpStatus.BAD_REQUEST),
      host,
    )

    expect(captured.status).toBe(400)
    expect(captured.body.error.code).toBe(SYSTEM_ERRORS.VALIDATION_FAILED.code)
    expect(captured.body.error.message).toBe('account 必填；password 必填')
  })

  it('404 映射成 SYS_9004', () => {
    const { host, captured } = buildHost()
    new BizExceptionFilter().catch(new NotFoundException(), host)

    expect(captured.body.error.code).toBe(SYSTEM_ERRORS.NOT_FOUND.code)
  })

  it('字符串型 HttpException 响应体也能取到文案', () => {
    const { host, captured } = buildHost()
    new BizExceptionFilter().catch(new HttpException('自定义文案', HttpStatus.BAD_REQUEST), host)

    expect(captured.body.error.message).toBe('自定义文案')
  })

  it('未知异常一律 SYS_9000 + 500，并打 error 级日志', () => {
    const { host, captured } = buildHost()
    new BizExceptionFilter().catch(new TypeError('boom'), host)

    expect(captured.status).toBe(500)
    expect(captured.body.error.code).toBe('SYS_9000')
    expect(errorSpy).toHaveBeenCalled()
  })

  it('非 Error 抛出物也不会让过滤器崩溃', () => {
    const { host, captured } = buildHost()
    new BizExceptionFilter().catch('plain string', host)

    expect(captured.status).toBe(500)
    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), 'plain string')
  })
})
