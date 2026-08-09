/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

interface ImportMetaEnv {
  /** 接口基地址，默认 /api/v1，见 docs/api/api-conventions.md */
  readonly VITE_API_BASE_URL?: string
  /** 是否使用前端 mock（后端未就绪时的开发态开关） */
  readonly VITE_USE_MOCK?: string
  /** 开发代理指向的后端地址 */
  readonly VITE_API_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
