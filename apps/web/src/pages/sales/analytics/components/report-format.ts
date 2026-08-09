/** 报表通用格式化：百分比、带符号百分比、金额（万元）。 */

export function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`
}

export function signedPct(value: number, digits = 1): string {
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(digits)}%`
}

export function wan(value: number, digits = 1): string {
  return value.toFixed(digits)
}

export function signed(value: number, digits = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`
}

export function levelTag(level: string): 'success' | 'warning' | 'danger' | 'info' {
  if (level === 'alert' || level === 'churn' || level === 'over' || level === 'late') {
    return 'danger'
  }
  if (level === 'watch' || level === 'risk' || level === 'tight' || level === 'due' || level === 'idle') {
    return 'warning'
  }
  if (level === 'ok') {
    return 'success'
  }
  return 'info'
}
