/** 账号分域（ADR-0004 内外账号分域）：内部员工 / 客户与供应商门户。 */
export type LoginAudience = 'internal' | 'portal'

export const LOGIN_AUDIENCES: readonly LoginAudience[] = ['internal', 'portal'] as const

export function isLoginAudience(value: string): value is LoginAudience {
  return LOGIN_AUDIENCES.includes(value as LoginAudience)
}
