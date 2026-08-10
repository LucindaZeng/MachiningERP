/**
 * 预览配置（deployment-environment.md 3.1 / 3.3）。
 *
 * `KK_PREVIEW_BASE_URL` 本地是 `http://localhost:8012`，生产经 Nginx 反代后
 * 是 `https://<域名>/preview`。一律读环境变量——把主机名写进代码，
 * 换个部署环境就得改代码重新发版。
 */
/** DI 令牌，理由同 object-storage：默认值救不了 Nest 的依赖解析。 */
export const FILE_PREVIEW_CONFIG = Symbol('FILE_PREVIEW_CONFIG')

export interface FilePreviewConfig {
  /** kkFileView 对外基础地址，末尾斜杠会被去掉 */
  baseUrl: string
  /** 预签名有效期（秒），硬上限 5 分钟 */
  ttlSeconds: number
}

/** 预签名 URL 交出去就不受我方控制了，所以有效期必须短且封顶。 */
export const MAX_PREVIEW_TTL_SECONDS = 300
export const DEFAULT_PREVIEW_TTL_SECONDS = 180

export function loadFilePreviewConfig(env: NodeJS.ProcessEnv = process.env): FilePreviewConfig {
  return {
    baseUrl: stripTrailingSlash(env.KK_PREVIEW_BASE_URL ?? 'http://localhost:8012'),
    ttlSeconds: clampTtl(Number.parseInt(env.KK_PREVIEW_TTL_SECONDS ?? '', 10)),
  }
}

/**
 * 有效期夹到 (0, 300]。传了超过 5 分钟的值不是报错而是截断——
 * 配置写大了应该降级成安全值，而不是让整个预览功能起不来。
 */
export function clampTtl(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_PREVIEW_TTL_SECONDS
  return Math.min(Math.floor(seconds), MAX_PREVIEW_TTL_SECONDS)
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}
