import { ACCOUNT_PATTERN } from '@machining-erp/shared'

export { ACCOUNT_PATTERN }

export const MIN_PASSWORD_LENGTH = 8

export function normalizeAccount(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase()
}

export function isValidAccount(value: string): boolean {
  return ACCOUNT_PATTERN.test(value)
}

/**
 * 用户名被占用时给出的候选建议：加数字后缀、加公司缩写、加年份。
 * 纯函数，可用性判定由调用方注入，便于单测。
 */
export function buildAccountSuggestions(account: string, year: number): string[] {
  const base = normalizeAccount(account).replace(/[^a-z0-9._]/g, '')
  if (!base) return []

  return [`${base}01`, `${base}.wfx`, `${base}${year % 100}`].filter((candidate) =>
    isValidAccount(candidate),
  )
}
