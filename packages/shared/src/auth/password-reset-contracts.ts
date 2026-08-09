import type { LoginAudience } from './login-audience'

/**
 * 忘记密码 = 向 IT 系统管理员提交重置申请。
 * 产品决策：不做邮箱/短信自助找回（见 docs/product/business-department-modules.md 平台联动需求）。
 */
export interface PasswordResetRequestContract {
  audience: LoginAudience
  account: string
  applicantName: string
  department: string
  contact: string
  reason?: string
}

export interface PasswordResetRequestResultContract {
  requestNo: string
  submittedAt: string
  /** 受理提示，例如「已派单至 IT 系统管理员，2 小时内处理」 */
  handlerHint: string
}
