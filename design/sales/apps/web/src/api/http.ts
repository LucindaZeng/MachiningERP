import { BizError } from './biz-error'
import { dispatchMock, isMockEnabled } from './mock/mock-server'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string
  body?: unknown
  token?: string
  /** POST 建单据幂等键，见 api-conventions.md「写操作幂等」 */
  idempotencyKey?: string
}

interface ApiEnvelope<T> {
  data: T
  meta?: Record<string, unknown>
}

interface ApiErrorEnvelope {
  error?: { code?: string; message?: string; traceId?: string; captchaRequired?: boolean }
}

/** 统一请求出口：只负责传输与错误归一化，不承载任何业务规则。 */
export async function request<T>(options: RequestOptions): Promise<T> {
  if (isMockEnabled()) {
    return dispatchMock<T>(options)
  }

  const response = await fetch(`${BASE_URL}${options.url}`, {
    method: options.method,
    headers: buildHeaders(options),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & ApiErrorEnvelope

  if (!response.ok) {
    throw new BizError({
      code: payload.error?.code ?? 'SYS_9000',
      message: payload.error?.message ?? `请求失败（HTTP ${response.status}）`,
      traceId: payload.error?.traceId,
      status: response.status,
      captchaRequired: payload.error?.captchaRequired,
    })
  }

  return payload.data
}

function buildHeaders(options: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey
  }

  return headers
}
