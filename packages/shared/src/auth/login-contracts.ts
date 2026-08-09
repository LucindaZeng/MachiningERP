import type { LoginAudience } from './login-audience'

export interface LoginRequestContract {
  audience: LoginAudience
  account: string
  password: string
  captchaId?: string
  captchaCode?: string
}

export interface LoginUserContract {
  id: string
  /**
   * 系统唯一编码：注册时单独生成，终身不变、永不复用。
   * 所有单据、审批、审计一律关联本编码，而不是用户名。
   */
  userCode: string
  /** 用户名：仅作登录用途，在职期间不重复，离职后释放可被他人再次登记 */
  account: string
  displayName: string
  department: string
  roles: string[]
  /** 权限点集合，前端 usePermission() 直接消费 */
  permissions: string[]
}

export interface LoginResultContract {
  accessToken: string
  /** 秒 */
  expiresIn: number
  user: LoginUserContract
}

export interface CaptchaChallengeContract {
  captchaId: string
  /** data:image/svg+xml;base64,... */
  imageUrl: string
  /** 秒 */
  expiresIn: number
}
