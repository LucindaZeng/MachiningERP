const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }

/** 把 `8h` / `45m` / `7d` / `3600` 解析成秒；非法输入直接抛错，避免签发出永不过期的 token。 */
export function parseDurationSeconds(value: string): number {
  const trimmed = value.trim()
  const matched = /^(\d+)([smhd])?$/.exec(trimmed)
  if (!matched) {
    throw new RangeError(`无法解析的有效期：${value}（示例：3600、45m、8h、7d）`)
  }

  const amount = Number.parseInt(matched[1] ?? '', 10)
  const unit = matched[2] ?? 's'
  const factor = UNIT_SECONDS[unit]

  if (!Number.isFinite(amount) || amount <= 0 || factor === undefined) {
    throw new RangeError(`无法解析的有效期：${value}`)
  }

  return amount * factor
}
