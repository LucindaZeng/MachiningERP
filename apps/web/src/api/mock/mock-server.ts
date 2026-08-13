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
 * 出参一律**深拷贝**后再交出去。
 *
 * 这不是防御式编程，是在补一条真实后端天然具备、mock 却没有的性质：
 * 走 HTTP 时每个响应都经 `JSON.parse` 产生**全新对象**，而 mock 处理器
 * 普遍是「就地改 fixture 数组里的那条、再把同一个引用返回」。
 * 于是 `current.value = updated` 两边是同一个原始对象，Vue 的 `hasChanged`
 * 判定为没变、不触发更新；而就地改动又绕过了响应式代理——
 * **界面看起来像是按钮没反应，其实数据早就改了**。
 *
 * 同一份拷贝也挡住了反方向：页面拿到的对象不再是 fixture 本体，
 * 组件里随手改一个字段不会把「数据库」一起改掉。
 *
 * 放在分发出口这一处做，比在十几个 *.mock.ts 里各自记得 clone 一次可靠。
 */
function detach<T>(value: T): T {
  return typeof structuredClone === 'function' ? structuredClone(value) : value
}

/** mock 路由表：只做「路径 → mock 处理器」的分发，业务假数据在各 *.mock.ts 内。 */
export async function dispatchMock<T>(options: RequestOptions): Promise<T> {
  return detach(await route<T>(options))
}

async function route<T>(options: RequestOptions): Promise<T> {
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
