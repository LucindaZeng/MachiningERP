/**
 * 密码强度评分（0–4）：长度、大小写、数字、符号各占一档。
 * 抽成纯函数是为了让「强度提示」与后端密码策略共用同一套判定，改规则时只改这一处。
 */
export function scorePassword(value: string): number {
  if (!value) {
    return 0
  }

  let score = 0
  if (value.length >= 8) score += 1
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1
  if (/\d/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1
  return score
}
