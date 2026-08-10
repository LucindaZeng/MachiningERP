import { BizError } from '../biz-error'

import { mockCheckAccount, mockSubmitAccountRequest } from './account-request.mock'
import { mockIssueCaptcha, mockLogin, mockLogout } from './auth.mock'
import { mockDownloadUrl, mockPreviewUrl } from './file-preview.mock'
import { mockSubmitPasswordResetRequest } from './password-reset.mock'
import { dispatchSalesMock } from './sales/sales.mock'
import { dispatchUploadMock } from './upload.mock'

import type { RequestOptions } from '../http'
import type {
  AccountRequestInput,
  LoginRequest,
  PasswordResetRequestInput,
} from '@/types/auth.types'

const NETWORK_DELAY_MS = 420

/**
 * 是否使用前端 mock。
 * 显式配置 VITE_USE_MOCK 时以配置为准；未配置时开发态默认开启、生产构建默认关闭
 * （.env.* 被仓库 .gitignore 忽略，新同事克隆后无需先复制环境变量即可跑起来）。
 */
export function isMockEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_MOCK
  return flag === undefined || flag === '' ? import.meta.env.DEV : flag === 'true'
}

/** mock 路由表：只做「路径 → mock 处理器」的分发，业务假数据在各 *.mock.ts 内。 */
export async function dispatchMock<T>(options: RequestOptions): Promise<T> {
  await delay(NETWORK_DELAY_MS)

  // 查询串只影响筛选，不影响路由匹配——真实后端也是按路径分发的
  const path = options.url.split('?')[0] ?? options.url
  const route = `${options.method} ${path}`

  switch (route) {
    case 'GET /auth/captcha':
      return mockIssueCaptcha() as T
    case 'POST /auth/login':
      return mockLogin(options.body as LoginRequest) as T
    case 'POST /auth/logout':
      return mockLogout() as T
    case 'POST /auth/password-reset-requests':
      return mockSubmitPasswordResetRequest(options.body as PasswordResetRequestInput) as T
    case 'POST /auth/account-requests':
      return mockSubmitAccountRequest(options.body as AccountRequestInput) as T
    case 'POST /auth/account-availability':
      return mockCheckAccount((options.body as { account: string }).account) as T
    default:
      return dispatchFilePreview<T>(options.method, path) ?? dispatchSalesRoute<T>(route, options.body)
  }
}

/** 平台能力的预览端点带两段路径参数，字面量路由表匹配不了，单独认一下。 */
const PREVIEW_ROUTE = /^\/files\/([^/]+)\/([^/]+)\/(preview-url|download-url)$/

function dispatchFilePreview<T>(method: string, path: string): T | null {
  if (method !== 'GET') return null

  const matched = PREVIEW_ROUTE.exec(path)
  if (!matched) return null

  const [, ownerType = '', ownerId = '', kind] = matched
  const view = kind === 'download-url' ? mockDownloadUrl(ownerType) : mockPreviewUrl(ownerType, ownerId)
  return view as T
}

function dispatchSalesRoute<T>(route: string, body: unknown): T {
  const result = dispatchSalesMock(route, body)

  if (!result.handled) {
    throw new BizError({ code: 'SYS_9404', message: `mock 未实现的接口：${route}`, status: 404 })
  }

  return result.data as T
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export { dispatchUploadMock }
