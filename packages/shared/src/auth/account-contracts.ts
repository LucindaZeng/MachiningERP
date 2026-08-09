/** 用户名规则：4–20 位，字母开头，只允许小写字母、数字、点与下划线。 */
export const ACCOUNT_PATTERN = /^[a-z][a-z0-9._]{3,19}$/

export interface AccountRequestContract {
  employeeName: string
  department: string
  /** 用户名：只做登录用途；在职期间不可重复，离职后释放 */
  account: string
  password: string
  confirmPassword: string
  contact?: string
  reason?: string
}

export interface AccountRequestResultContract {
  requestNo: string
  account: string
  /** 本次注册生成的唯一编码：终身不变、永不复用，与用户名无关 */
  userCode: string
  submittedAt: string
  /** 若本次登记的用户名曾由已离职员工使用，这里给出原使用人与离职日期 */
  reusedFrom?: string
  handlerHint: string
}

/** 用户名可用性校验结果（只校验登录用户名，不涉及唯一编码） */
export interface AccountAvailabilityContract {
  account: string
  available: boolean
  /** 离职释放出来的用户名：available 仍为 true，但界面需提示原使用人 */
  released?: boolean
  reason?: string
  suggestions: string[]
}
