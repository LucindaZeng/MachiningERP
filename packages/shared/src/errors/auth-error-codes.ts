import type { BizErrorDefinition } from './error-segment'

/** AUTH_1xxx —— 认证与账号（前端 apps/web 的 mock 已按同一套码值实现，切真接口后语义一致）。 */
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: {
    code: 'AUTH_1001',
    status: 401,
    message: '账号或密码不正确',
  },
  CAPTCHA_REQUIRED: {
    code: 'AUTH_1002',
    status: 400,
    message: '连续登录失败次数过多，请先通过图形验证码',
  },
  CAPTCHA_INVALID: {
    code: 'AUTH_1003',
    status: 400,
    message: '图形验证码错误或已过期，请重新输入',
  },
  ACCOUNT_LOCKED: {
    code: 'AUTH_1005',
    status: 423,
    message: '账号已被临时锁定，请 30 分钟后重试或联系 IT 管理员解锁',
  },
  TOKEN_INVALID: {
    code: 'AUTH_1006',
    status: 401,
    message: '登录已失效，请重新登录',
  },
  FORBIDDEN: {
    code: 'AUTH_1007',
    status: 403,
    message: '没有该操作的权限',
  },
  AUDIENCE_MISMATCH: {
    code: 'AUTH_1008',
    status: 401,
    message: '账号域不匹配：内部账号与门户账号不可互登',
  },
  ACCOUNT_DISABLED: {
    code: 'AUTH_1030',
    status: 403,
    message: '该账号持有人已离职，账号已停用；用户名已释放，可由新员工重新申请',
  },
  REQUEST_FIELDS_REQUIRED: {
    code: 'AUTH_1020',
    status: 422,
    message: '员工姓名、所属部门与用户名为必填项',
  },
  ACCOUNT_PATTERN_INVALID: {
    code: 'AUTH_1021',
    status: 422,
    message: '用户名需 4–20 位，以字母开头，只能包含小写字母、数字、点或下划线',
  },
  ACCOUNT_TAKEN: {
    code: 'AUTH_1022',
    status: 409,
    message: '用户名已被占用，请更换后重新提交',
  },
  PASSWORD_TOO_SHORT: {
    code: 'AUTH_1023',
    status: 422,
    message: '密码至少 8 位',
  },
  PASSWORD_MISMATCH: {
    code: 'AUTH_1024',
    status: 422,
    message: '两次输入的密码不一致',
  },
  RESET_FIELDS_REQUIRED: {
    code: 'AUTH_1040',
    status: 422,
    message: '账号、姓名、部门与联系方式为必填项',
  },
  RESET_DUPLICATED: {
    code: 'AUTH_1041',
    status: 409,
    message: '该账号已有待处理的密码重置申请，请勿重复提交',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type AuthErrorKey = keyof typeof AUTH_ERRORS
