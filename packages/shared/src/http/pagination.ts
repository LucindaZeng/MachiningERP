export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200

export interface PageQuery {
  page: number
  pageSize: number
  /** `-createdAt` 表示倒序，`createdAt` 表示正序 */
  sort?: string
  q?: string
}

export interface PageResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export function normalizePageQuery(input: Partial<PageQuery>): PageQuery {
  const page = Math.max(1, Math.trunc(input.page ?? 1))
  const requested = Math.trunc(input.pageSize ?? DEFAULT_PAGE_SIZE)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested))
  return { page, pageSize, sort: input.sort, q: input.q }
}

export function parseSort(sort: string | undefined): { field: string; direction: 'asc' | 'desc' } | null {
  if (!sort) return null
  const direction = sort.startsWith('-') ? 'desc' : 'asc'
  const field = sort.replace(/^[-+]/, '')
  return field ? { field, direction } : null
}
