import type { AccountRequestInput } from '@/types/auth.types'
import type { FormRules } from 'element-plus'

/** 用户名规则与后端一致：4–20 位，字母开头，只允许小写字母、数字、点与下划线 */
const ACCOUNT_PATTERN = /^[a-z][a-z0-9._]{3,19}$/

/**
 * 用户名大小写不敏感：一律按小写比对与提交，
 * 否则 Zhang.san 与 zhang.san 会被当成两个用户名各自登记。
 */
export function normalizeAccount(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

/**
 * 校验规则要读表单的实时值（确认密码需与密码逐次比对），
 * 因此接收 reactive 表单本身而不是某一时刻的快照。
 */
export function createAccountRequestRules(
  form: AccountRequestInput,
): FormRules<AccountRequestInput> {
  return {
    employeeName: [{ required: true, message: '请输入员工姓名', trigger: 'blur' }],
    department: [{ required: true, message: '请选择所属部门', trigger: 'change' }],
    account: [
      { required: true, message: '请输入用户名', trigger: 'blur' },
      {
        trigger: 'blur',
        validator: (_r, value: string, cb) =>
          ACCOUNT_PATTERN.test(normalizeAccount(value))
            ? cb()
            : cb(new Error('用户名需 4–20 位，以字母开头，只能包含小写字母、数字、点或下划线')),
      },
    ],
    password: [
      { required: true, message: '请输入密码', trigger: 'blur' },
      { min: 8, message: '密码至少 8 位', trigger: 'blur' },
    ],
    confirmPassword: [
      {
        trigger: 'blur',
        validator: (_r, value: string, cb) =>
          value === form.password ? cb() : cb(new Error('两次输入的密码不一致')),
      },
    ],
  }
}

/**
 * 提交按钮的可用条件。
 * 比表单规则更严：用户名必须已经过服务端可用性确认（accountReady），
 * 否则会出现「本地格式合法但用户名已被占用」的无效提交。
 */
export function isAccountRequestComplete(
  form: AccountRequestInput,
  accountReady: boolean,
): boolean {
  return (
    Boolean(form.employeeName.trim()) &&
    Boolean(form.department) &&
    accountReady &&
    form.password.length >= 8 &&
    form.password === form.confirmPassword
  )
}
