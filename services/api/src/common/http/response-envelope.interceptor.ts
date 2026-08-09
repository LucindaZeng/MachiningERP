import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common'
import { map, type Observable } from 'rxjs'

import type { ApiEnvelope, ApiMeta } from '@machining-erp/shared'

/** 控制器返回该结构时，meta 原样透出；否则整体作为 data。 */
export interface EnvelopePayload<T> {
  data: T
  meta: ApiMeta
}

function isEnvelopePayload<T>(value: unknown): value is EnvelopePayload<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'meta' in value &&
    Object.keys(value).length === 2
  )
}

/** 统一响应包裹 `{ data, meta }`（api-conventions.md「请求约定」）。 */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, ApiEnvelope<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiEnvelope<T>> {
    return next.handle().pipe(
      map((payload) => {
        if (isEnvelopePayload<T>(payload)) {
          return { data: payload.data, meta: payload.meta }
        }
        return { data: payload }
      }),
    )
  }
}
