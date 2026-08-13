import { BizError } from './biz-error'
import { MOCK_ENABLED } from './mock-switch'

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

/**
 * 统一请求出口：只负责传输与错误归一化，不承载任何业务规则。
 *
 * mock 走**动态 import**：`MOCK_ENABLED` 是构建期常量，关闭时整个分支连同
 * 那棵假数据依赖树一起被摇掉，不会进生产包（理由见 mock-switch.ts）。
 */
export async function request<T>(options: RequestOptions): Promise<T> {
  if (MOCK_ENABLED) {
    const { dispatchMock } = await import('./mock/mock-server')
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

/**
 * 带进度的 multipart 上传。
 *
 * 用 XMLHttpRequest 而不是 fetch：`fetch` 至今拿不到上传进度，
 * 而一张几十兆的图纸传上去没有进度条，用户只会以为界面卡死了。
 * Content-Type 交给浏览器自己带（要含 multipart 边界），这里不能手写。
 */
export interface UploadOptions {
  url: string
  file: File
  /** 一并提交的表单字段，如图号、版本、订单 id */
  fields?: Record<string, string | undefined>
  token?: string
  onProgress?: (percent: number) => void
}

export async function upload<T>(options: UploadOptions): Promise<T> {
  if (MOCK_ENABLED) {
    const { dispatchUploadMock } = await import('./mock/mock-server')
    return dispatchUploadMock<T>(options)
  }

  const body = new FormData()
  body.append('file', options.file)
  for (const [key, value] of Object.entries(options.fields ?? {})) {
    if (value !== undefined && value !== '') {
      body.append(key, value)
    }
  }

  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${BASE_URL}${options.url}`)
    if (options.token) {
      request.setRequestHeader('Authorization', `Bearer ${options.token}`)
    }

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    })

    request.addEventListener('load', () => {
      const payload = parseJson(request.responseText)
      if (request.status >= 200 && request.status < 300) {
        resolve((payload as ApiEnvelope<T>).data)
        return
      }
      reject(toBizError(payload as ApiErrorEnvelope, request.status))
    })

    request.addEventListener('error', () => {
      reject(new BizError({ code: 'SYS_9000', message: '上传失败：网络异常', status: 0 }))
    })
    request.addEventListener('abort', () => {
      reject(new BizError({ code: 'SYS_9000', message: '上传已取消', status: 0 }))
    })

    request.send(body)
  })
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return {}
  }
}

function toBizError(payload: ApiErrorEnvelope, status: number): BizError {
  return new BizError({
    code: payload.error?.code ?? 'SYS_9000',
    message: payload.error?.message ?? `上传失败（HTTP ${status}）`,
    traceId: payload.error?.traceId,
    status,
  })
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
