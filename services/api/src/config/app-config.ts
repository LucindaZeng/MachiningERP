export interface AuthConfig {
  jwtSecret: string
  jwtExpiresIn: string
  /** 连续失败达到该次数后强制图形验证码 */
  captchaThreshold: number
  /** 连续失败达到该次数后临时锁定 */
  lockThreshold: number
  lockMinutes: number
  captchaTtlSeconds: number
}

export interface AppConfig {
  port: number
  globalPrefix: string
  nodeEnv: string
  auth: AuthConfig
}

function intFrom(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const APP_CONFIG_KEY = 'app'

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const secret = env.JWT_SECRET ?? ''
  if (env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('生产环境必须提供长度 ≥ 32 的 JWT_SECRET')
  }

  return {
    port: intFrom(env.API_PORT, 3000),
    globalPrefix: env.API_GLOBAL_PREFIX ?? 'api/v1',
    nodeEnv: env.NODE_ENV ?? 'development',
    auth: {
      jwtSecret: secret || 'development-only-secret-change-me-32ch',
      jwtExpiresIn: env.JWT_EXPIRES_IN ?? '8h',
      captchaThreshold: intFrom(env.LOGIN_CAPTCHA_THRESHOLD, 3),
      lockThreshold: intFrom(env.LOGIN_LOCK_THRESHOLD, 8),
      lockMinutes: intFrom(env.LOGIN_LOCK_MINUTES, 30),
      captchaTtlSeconds: intFrom(env.CAPTCHA_TTL_SECONDS, 120),
    },
  }
}
