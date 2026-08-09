/**
 * 认证相关契约类型。
 * 说明：M0 完成 packages/shared 后，本文件内容整体迁移至 packages/shared/auth，
 * 由前后端共享并生成 OpenAPI（见 docs/development/development-guide.md 第 1 节）。
 */

/** 账号分域：内部员工 / 客户与供应商门户（ADR-0004 内外账号分域） */
export type LoginAudience = 'internal' | 'portal'

export interface LoginRequest {
  audience: LoginAudience
  account: string
  password: string
  captchaId?: string
  captchaCode?: string
}

export interface LoginUser {
  id: string
  /**
   * 系统唯一编码：每次注册单独生成，终身不变、永不复用。
   * 所有单据、审批、留痕一律关联本编码，而不是用户名。
   */
  userCode: string
  /** 用户名：只做登录用途，在职期间不重复，离职后释放可被他人再次登记 */
  account: string
  displayName: string
  department: string
  roles: string[]
}

export interface LoginResult {
  accessToken: string
  /** 秒 */
  expiresIn: number
  user: LoginUser
}

export interface CaptchaChallenge {
  captchaId: string
  /** data:image/svg+xml;base64,... */
  imageUrl: string
  /** 秒 */
  expiresIn: number
}

export interface PasswordResetRequestInput {
  audience: LoginAudience
  account: string
  applicantName: string
  department: string
  contact: string
  reason?: string
}

export interface PasswordResetRequestResult {
  requestNo: string
  submittedAt: string
  /** 受理提示，例如「已派单至 IT 系统管理员，2 小时内处理」 */
  handlerHint: string
}

/* ---------------- 账户申请（内部员工自助申请，IT 审批开通）---------------- */

export interface AccountRequestInput {
  /** 员工姓名 */
  employeeName: string
  /** 所属部门 */
  department: string
  /** 用户名：只做登录用途；在职期间不可重复，离职后释放 */
  account: string
  password: string
  confirmPassword: string
  /** 联系方式便于 IT 核实身份 */
  contact?: string
  reason?: string
}

export interface AccountRequestResult {
  requestNo: string
  /** 登录用的用户名 */
  account: string
  /** 本次注册生成的唯一编码：终身不变、永不复用，与用户名无关 */
  userCode: string
  submittedAt: string
  /** 若本次登记的用户名曾由已离职员工使用，这里给出原使用人与离职日期 */
  reusedFrom?: string
  handlerHint: string
}

/** 用户名可用性校验结果（只校验登录用户名，不涉及唯一编码） */
export interface AccountAvailability {
  account: string
  available: boolean
  /**
   * 该用户名曾由已离职员工使用、现已释放：available 仍为 true（可登记），
   * 界面需提示原使用人与离职日期。本次注册会生成新的唯一编码，与原使用人无关。
   */
  released?: boolean
  reason?: string
  /** 被占用时给出的可用建议 */
  suggestions: string[]
}
