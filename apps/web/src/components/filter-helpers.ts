/** 列表筛选条件的取值类型 */
export type FilterValue = string | string[] | undefined

export type FilterValues = Record<string, FilterValue>

export interface FilterOption {
  label: string
  value: string
}

export interface FilterField {
  key: string
  label: string
  type: 'input' | 'select' | 'date-range' | 'number-range'
  options?: FilterOption[]
  placeholder?: string
  /** 控件宽度（px），不填按类型取默认值 */
  width?: number
}

/** 下拉等值匹配：空值视为「全部」 */
export function matchEq(rowValue: string | boolean | undefined, filter: FilterValue): boolean {
  if (!filter) {
    return true
  }
  return String(rowValue) === String(filter)
}

/** 文本包含匹配（大小写不敏感） */
export function matchText(rowValue: string | undefined, filter: FilterValue): boolean {
  if (!filter || typeof filter !== 'string') {
    return true
  }
  return (rowValue ?? '').toLowerCase().includes(filter.trim().toLowerCase())
}

/** 日期区间匹配，rowValue 形如 2026-07-28 或 2026-07-28 15:00 */
export function matchDateRange(rowValue: string | undefined, filter: FilterValue): boolean {
  if (!Array.isArray(filter) || filter.length !== 2 || !filter[0] || !filter[1]) {
    return true
  }
  const value = (rowValue ?? '').slice(0, 10)
  return Boolean(value) && value >= filter[0] && value <= filter[1]
}

/** 数值区间匹配，filter 为 [min, max]，任一端可空 */
export function matchNumberRange(rowValue: string | number | undefined, filter: FilterValue): boolean {
  if (!Array.isArray(filter)) {
    return true
  }
  const [min, max] = filter
  const value = Number(rowValue ?? 0)
  if (min !== '' && min !== undefined && value < Number(min)) {
    return false
  }
  if (max !== '' && max !== undefined && value > Number(max)) {
    return false
  }
  return true
}

/** 由字段定义生成初始值（区间类型给 ['','']，其余空字符串） */
export function emptyFilters(fields: FilterField[]): FilterValues {
  return fields.reduce<FilterValues>((acc, field) => {
    acc[field.key] = field.type === 'date-range' || field.type === 'number-range' ? ['', ''] : ''
    return acc
  }, {})
}

/** 已生效的筛选条件数量，用于在界面上提示 */
export function activeFilterCount(values: FilterValues): number {
  return Object.values(values).filter((value) =>
    Array.isArray(value) ? value.some(Boolean) : Boolean(value),
  ).length
}
