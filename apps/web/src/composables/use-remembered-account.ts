import type { LoginAudience } from '@/types/auth.types'

const STORAGE_KEY = 'erp.login.remembered-account'

interface RememberedAccount {
  audience: LoginAudience
  account: string
}

/**
 * 「记住我」只保存账号与入口，绝不保存密码或 token。
 * 见 docs/architecture/data-and-security.md 的凭据处理要求。
 */
export function useRememberedAccount() {
  function read(): RememberedAccount | null {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    try {
      const parsed = JSON.parse(raw) as RememberedAccount
      return parsed.account ? parsed : null
    } catch {
      return null
    }
  }

  function save(audience: LoginAudience, account: string): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ audience, account: account.trim() }))
  }

  function clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  }

  return { read, save, clear }
}
