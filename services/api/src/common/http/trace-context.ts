import { randomUUID } from 'node:crypto'

import type { NextFunction, Request, Response } from 'express'

export const TRACE_ID_HEADER = 'x-trace-id'

declare module 'express-serve-static-core' {
  interface Request {
    traceId?: string
  }
}

/** 为每个请求分配 traceId，贯穿日志、审计与错误响应（api-conventions.md「审计与计时」）。 */
export function traceContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(TRACE_ID_HEADER)
  const traceId = incoming && incoming.length <= 64 ? incoming : randomUUID()
  req.traceId = traceId
  res.setHeader(TRACE_ID_HEADER, traceId)
  next()
}

export function traceIdOf(req: Request | undefined): string {
  return req?.traceId ?? 'unknown'
}
