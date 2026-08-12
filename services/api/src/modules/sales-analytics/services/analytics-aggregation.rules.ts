/**
 * 聚合口径的纯函数。**只做算术与分组，不含任何业务规则**
 * （规格第 11 章：数据分析是只读聚合，规则属于产生数据的那个模块）。
 *
 * 全部纯函数、全部可单测：BI 数字错了没人会立刻发现，
 * 因此这一层比别处更需要被钉死。
 */

/** 万元。前端所有金额面板都按万元展示（fixture 基线），保留一位小数。 */
export function toTenThousand(minor: bigint): number {
  // 分 → 元 → 万元；先转 Number 再除会在大额时丢精度，故先用 bigint 缩到元
  const yuan = Number(minor) / 100
  return Math.round((yuan / 10_000) * 10) / 10
}

/** 元。用于单价一类不到万元量级的展示值。 */
export function toYuan(minor: bigint): number {
  return Math.round(Number(minor)) / 100
}

/** 比率 → 百分比小数（0.426）。分母为 0 时返回 null——**不是 0**。 */
export function rateOf(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 1000
}

/**
 * 占比。分母为 0 时整组返回空——一组「占比全是 0%」的饼图比没有饼图更误导。
 */
export function shareOf(values: readonly number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return []
  return values.map((value) => Math.round((value / total) * 1000) / 1000)
}

/** 小时差，保留一位小数；任一端缺失返回 null。 */
export function hoursBetween(from: Date | null, to: Date | null): number | null {
  if (!from || !to) return null
  return Math.round(((to.getTime() - from.getTime()) / 3_600_000) * 10) / 10
}

/** 天数差（向下取整）；任一端缺失返回 null。 */
export function daysBetween(from: Date | null, to: Date | null): number | null {
  if (!from || !to) return null
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

/** 均值，保留一位小数。空集返回 null——**均值不存在，不是 0**。 */
export function averageOf(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sum = values.reduce((total, value) => total + value, 0)
  return Math.round((sum / values.length) * 10) / 10
}

/** 本地日期键 `YYYY-MM-DD`。日报按自然日归集，用 UTC 会把晚班算到第二天。 */
export function dateKeyOf(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 月份键 `YYYY-MM`。 */
export function monthKeyOf(value: Date): string {
  return dateKeyOf(value).slice(0, 7)
}

/** 从 `to` 往前推 `days` 天的连续日期键（含首尾）——**日报不能跳过零发生的日子**。 */
export function dateKeysBackFrom(to: Date, days: number): string[] {
  const keys: string[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(to.getFullYear(), to.getMonth(), to.getDate() - offset)
    keys.push(dateKeyOf(day))
  }
  return keys
}

/** 按键分组。 */
export function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const bucket = groups.get(key)
    if (bucket) bucket.push(item)
    else groups.set(key, [item])
  }
  return groups
}

/** 求和。 */
export function sumBy<T>(items: readonly T[], valueOf: (item: T) => number): number {
  return items.reduce((total, item) => total + valueOf(item), 0)
}

export function sumMinorBy<T>(items: readonly T[], valueOf: (item: T) => bigint): bigint {
  return items.reduce((total, item) => total + valueOf(item), 0n)
}

/**
 * 取前 N 名并按值降序。
 *
 * 并列时按标签排序而不是保留原顺序：排行榜每次刷新顺序都变，
 * 会让人以为业绩在波动，其实只是遍历顺序不同。
 */
export function topN<T>(
  items: readonly T[],
  valueOf: (item: T) => number,
  labelOf: (item: T) => string,
  limit: number,
): T[] {
  return [...items]
    .sort((left, right) => {
      const byValue = valueOf(right) - valueOf(left)
      return byValue !== 0 ? byValue : labelOf(left).localeCompare(labelOf(right))
    })
    .slice(0, limit)
}

/** 数量（decimal 字符串）求和后回到字符串，避免浮点参与金额换算。 */
export function sumQuantity(values: readonly string[]): number {
  return values.reduce((total, value) => total + Number(value), 0)
}

/** 落在 [from, to] 内（含端点）；日期为空一律不计入。 */
export function withinPeriod(value: Date | null, from: Date, to: Date): boolean {
  if (!value) return false
  return value.getTime() >= from.getTime() && value.getTime() <= to.getTime()
}

/** 一组分组的汇总结果：键、成员、金额与占比，一次配齐。 */
export interface GroupShare<T> {
  key: string
  items: T[]
  amountMinor: bigint
  share: number
}

/**
 * 分组 + 求和 + 算占比，一步到位。
 *
 * 存在的理由是消灭「两个平行数组按下标配对」那种写法——
 * `amounts[index] ?? 0n` 里的 `?? 0n` 永远不会发生，却让每个调用点
 * 都多出两条测不到的分支，读的人还得停下来想一下它会不会真的为空。
 */
export function groupWithShares<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  amountOf: (item: T) => bigint,
): Array<GroupShare<T>> {
  const groups = [...groupBy(items, keyOf)]
  const amounts = groups.map(([, members]) => members.reduce((sum, item) => sum + amountOf(item), 0n))
  const shares = shareOf(amounts.map((minor) => Number(minor)))

  return groups.map(([key, members], index) => ({
    key,
    items: members,
    amountMinor: amounts[index] as bigint,
    share: shares[index] ?? 0,
  }))
}
