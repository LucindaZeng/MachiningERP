import { MAX_PAGE_SIZE, normalizePageQuery, parseSort } from '../pagination'

describe('分页归一化（pageSize ≤ 200）', () => {
  it('缺省值', () => {
    expect(normalizePageQuery({})).toEqual({ page: 1, pageSize: 50, sort: undefined, q: undefined })
  })

  it('下限保护', () => {
    expect(normalizePageQuery({ page: 0, pageSize: 0 }).page).toBe(1)
    expect(normalizePageQuery({ page: -3, pageSize: -1 }).pageSize).toBe(1)
  })

  it('上限截断到 200', () => {
    expect(normalizePageQuery({ pageSize: 5000 }).pageSize).toBe(MAX_PAGE_SIZE)
  })
})

describe('排序解析', () => {
  it('`-createdAt` 表示倒序', () => {
    expect(parseSort('-createdAt')).toEqual({ field: 'createdAt', direction: 'desc' })
    expect(parseSort('createdAt')).toEqual({ field: 'createdAt', direction: 'asc' })
    expect(parseSort('+createdAt')).toEqual({ field: 'createdAt', direction: 'asc' })
  })

  it('空值与纯符号返回 null', () => {
    expect(parseSort(undefined)).toBeNull()
    expect(parseSort('-')).toBeNull()
  })
})
