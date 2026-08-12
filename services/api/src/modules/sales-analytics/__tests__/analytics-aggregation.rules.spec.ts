import {
  averageOf,
  dateKeyOf,
  dateKeysBackFrom,
  daysBetween,
  groupBy,
  hoursBetween,
  monthKeyOf,
  rateOf,
  shareOf,
  sumBy,
  sumMinorBy,
  sumQuantity,
  toTenThousand,
  toYuan,
  topN,
  withinPeriod,
} from '../services/analytics-aggregation.rules'

describe('金额单位换算', () => {
  it('分 → 万元，保留一位小数', () => {
    expect(toTenThousand(3_700_140n)).toBe(3.7)
    // 48_600_000 分 = 486_000 元 = 48.6 万元
    expect(toTenThousand(48_600_000n)).toBe(48.6)
  })

  it('分 → 元', () => {
    expect(toYuan(2_490n)).toBe(24.9)
    expect(toYuan(0n)).toBe(0)
  })

  it('大额不丢精度：先缩到元再转 Number', () => {
    // 一亿元 = 100_0000_0000 分
    expect(toTenThousand(10_000_000_000n)).toBe(10_000)
  })
})

/**
 * 这一组是本模块最要紧的约定：**分母为空时返回 null，不是 0**。
 * 一个填成 0 的比率在看板上读起来是真实业绩，而不是「没有数据」。
 */
describe('比率与均值：无数据返回 null 而不是 0', () => {
  it('分母为 0 的比率是 null', () => {
    expect(rateOf(0, 0)).toBeNull()
    expect(rateOf(5, 0)).toBeNull()
    expect(rateOf(-1, -1)).toBeNull()
  })

  it('有分母时正常算，保留三位小数', () => {
    expect(rateOf(1, 3)).toBe(0.333)
    expect(rateOf(3, 4)).toBe(0.75)
  })

  it('空集的均值是 null', () => {
    expect(averageOf([])).toBeNull()
  })

  it('有值时算均值，保留一位小数', () => {
    expect(averageOf([1, 2, 4])).toBe(2.3)
  })

  it('总量为 0 时占比整组为空——一组全 0% 的饼图比没有饼图更误导', () => {
    expect(shareOf([0, 0, 0])).toEqual([])
    expect(shareOf([])).toEqual([])
  })

  it('有总量时占比正常算', () => {
    expect(shareOf([1, 1, 2])).toEqual([0.25, 0.25, 0.5])
  })
})

describe('时间差', () => {
  const early = new Date('2026-07-26T09:00:00Z')
  const late = new Date('2026-07-26T11:48:00Z')

  it('小时差保留一位小数', () => {
    expect(hoursBetween(early, late)).toBe(2.8)
  })

  it('天数差向下取整', () => {
    expect(daysBetween(new Date('2026-07-01T00:00:00Z'), new Date('2026-07-04T23:00:00Z'))).toBe(3)
  })

  it('任一端缺失返回 null——「没有时间戳」不是「用了 0 小时」', () => {
    expect(hoursBetween(null, late)).toBeNull()
    expect(hoursBetween(early, null)).toBeNull()
    expect(daysBetween(null, null)).toBeNull()
  })
})

describe('日期键', () => {
  it('按本地日期成键——用 UTC 会把晚班算到第二天', () => {
    const evening = new Date(2026, 6, 26, 23, 30)
    expect(dateKeyOf(evening)).toBe('2026-07-26')
  })

  it('月份键取前七位', () => {
    expect(monthKeyOf(new Date(2026, 6, 26))).toBe('2026-07')
  })

  it('连续回溯不跳过零发生的日子——日报缺一天就看不出周末停产', () => {
    const keys = dateKeysBackFrom(new Date(2026, 6, 3), 3)
    expect(keys).toEqual(['2026-07-01', '2026-07-02', '2026-07-03'])
  })

  it('跨月回溯正确', () => {
    const keys = dateKeysBackFrom(new Date(2026, 6, 2), 3)
    expect(keys).toEqual(['2026-06-30', '2026-07-01', '2026-07-02'])
  })
})

describe('分组与求和', () => {
  const items = [
    { key: 'a', value: 1, minor: 100n, qty: '1.5' },
    { key: 'b', value: 2, minor: 200n, qty: '2.5' },
    { key: 'a', value: 3, minor: 300n, qty: '3.0' },
  ]

  it('按键分组保持插入顺序', () => {
    const groups = groupBy(items, (item) => item.key)
    expect([...groups.keys()]).toEqual(['a', 'b'])
    expect(groups.get('a')).toHaveLength(2)
  })

  it('空集分组得到空 Map', () => {
    expect(groupBy([], () => 'x').size).toBe(0)
  })

  it('求和', () => {
    expect(sumBy(items, (item) => item.value)).toBe(6)
    expect(sumMinorBy(items, (item) => item.minor)).toBe(600n)
    expect(sumQuantity(items.map((item) => item.qty))).toBe(7)
  })
})

describe('排行榜', () => {
  const rows = [
    { name: 'b', value: 5 },
    { name: 'a', value: 5 },
    { name: 'c', value: 9 },
  ]

  it('按值降序取前 N', () => {
    const top = topN(rows, (row) => row.value, (row) => row.name, 2)
    expect(top.map((row) => row.name)).toEqual(['c', 'a'])
  })

  it('并列时按标签排序——否则每次刷新顺序都变，看着像业绩在波动', () => {
    const top = topN(rows, (row) => row.value, (row) => row.name, 3)
    expect(top.map((row) => row.name)).toEqual(['c', 'a', 'b'])
  })

  it('不改原数组', () => {
    topN(rows, (row) => row.value, (row) => row.name, 3)
    expect(rows[0]!.name).toBe('b')
  })
})

describe('区间判定', () => {
  const from = new Date('2026-07-01T00:00:00Z')
  const to = new Date('2026-07-31T23:59:59Z')

  it('含端点', () => {
    expect(withinPeriod(from, from, to)).toBe(true)
    expect(withinPeriod(to, from, to)).toBe(true)
  })

  it('区间外不计入', () => {
    expect(withinPeriod(new Date('2026-08-01T00:00:00Z'), from, to)).toBe(false)
  })

  it('日期为空一律不计入——不是「算作在区间内」', () => {
    expect(withinPeriod(null, from, to)).toBe(false)
  })
})
