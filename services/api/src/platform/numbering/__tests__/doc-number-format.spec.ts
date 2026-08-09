import {
  formatDateSegment,
  formatDocNumber,
  periodKeyFor,
  type DocNumberPattern,
} from '../services/doc-number-format'

const AT = new Date(2026, 7, 8, 10, 30) // 本地时区 2026-08-08

describe('日期段格式化', () => {
  it.each([
    ['yyyy', '2026'],
    ['yyyyMM', '202608'],
    ['yyyyMMdd', '20260808'],
    ['', ''],
  ])('%s → %s', (pattern, expected) => {
    expect(formatDateSegment(pattern, AT)).toBe(expected)
  })

  it('未支持的格式直接抛错，避免悄悄发出错号', () => {
    expect(() => formatDateSegment('yyMMdd', AT)).toThrow(RangeError)
  })

  it('月与日补零', () => {
    expect(formatDateSegment('yyyyMMdd', new Date(2026, 0, 5))).toBe('20260105')
  })
})

describe('重置周期键', () => {
  it.each([
    ['NONE', '-'],
    ['YEARLY', '2026'],
    ['MONTHLY', '202608'],
    ['DAILY', '20260808'],
  ] as const)('%s → %s', (policy, expected) => {
    expect(periodKeyFor(policy, AT)).toBe(expected)
  })

  it('未知策略抛错', () => {
    expect(() => periodKeyFor('WEEKLY' as never, AT)).toThrow(RangeError)
  })
})

describe('单据编号拼装', () => {
  const daily: DocNumberPattern = {
    prefix: 'ACR',
    datePattern: 'yyyyMMdd',
    padding: 4,
    separator: '',
    resetPolicy: 'DAILY',
  }

  it('日重置单据：前缀 + 日期 + 4 位流水', () => {
    expect(formatDocNumber(daily, 1, AT)).toBe('ACR202608080001')
    expect(formatDocNumber(daily, 1234, AT)).toBe('ACR202608081234')
  })

  it('唯一编码：WFX-2026-0209 形式（带分隔符、按年重置）', () => {
    const userCode: DocNumberPattern = {
      prefix: 'WFX',
      datePattern: 'yyyy',
      padding: 4,
      separator: '-',
      resetPolicy: 'YEARLY',
    }
    expect(formatDocNumber(userCode, 209, AT)).toBe('WFX-2026-0209')
  })

  it('无日期段的编号（客户编号）不产生多余分隔符', () => {
    const customer: DocNumberPattern = {
      prefix: 'C',
      datePattern: '',
      padding: 4,
      separator: '',
      resetPolicy: 'NONE',
    }
    expect(formatDocNumber(customer, 7, AT)).toBe('C0007')
  })

  it('流水超出位数容量时抛错，而不是截断成重复号', () => {
    expect(() => formatDocNumber(daily, 10000, AT)).toThrow(/超出 4 位容量/)
  })

  it('非正整数流水一律拒绝', () => {
    expect(() => formatDocNumber(daily, 0, AT)).toThrow(RangeError)
    expect(() => formatDocNumber(daily, -1, AT)).toThrow(RangeError)
    expect(() => formatDocNumber(daily, 1.5, AT)).toThrow(RangeError)
  })
})
