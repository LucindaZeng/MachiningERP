import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import { traceIdOf } from '../http/trace-context'

import type { Request } from 'express'


export interface RequestContext {
  ip: string | null
  userAgent: string | null
  traceId: string
}

/** 控制器取 IP / UA / traceId 的统一入口，避免每个 controller 各写一遍解析。 */
export const Ctx = createParamDecorator((_data: unknown, context: ExecutionContext): RequestContext => {
  const request = context.switchToHttp().getRequest<Request>()

  return {
    ip: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null,
    traceId: traceIdOf(request),
  }
})
