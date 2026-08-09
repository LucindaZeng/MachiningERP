import type { LoginFormModel } from './login-form-state'
import type { useRememberedAccount } from './use-remembered-account'

type RememberedAccountStore = ReturnType<typeof useRememberedAccount>

/**
 * 把上次记住的账号回填进表单。
 * 只回填入口与账号并勾上「记住我」，密码永远不落盘，也就无从回填
 * （见 docs/architecture/data-and-security.md 的凭据处理要求）。
 */
export function restoreRememberedInto(form: LoginFormModel, store: RememberedAccountStore): void {
  const record = store.read()
  if (!record) {
    return
  }

  form.audience = record.audience
  form.account = record.account
  form.remember = true
}

/**
 * 登录成功后同步「记住我」的选择。
 * 取消勾选时要主动清除历史记录，否则上一次记住的账号会一直留在这台机器上。
 */
export function persistRememberedFrom(form: LoginFormModel, store: RememberedAccountStore): void {
  if (form.remember) {
    store.save(form.audience, form.account)
    return
  }

  store.clear()
}
