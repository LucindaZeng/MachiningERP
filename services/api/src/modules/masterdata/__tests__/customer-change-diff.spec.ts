import {
  changesToPatch,
  describeChanges,
  splitCustomerChanges,
} from '../services/customer-change-diff'

const BEFORE = {
  name: '苏州明泰',
  level: 'B 类',
  bankAccount: '6222 0000 0000 0000',
  paymentTerm: 'NET_60',
  hkPricingEnabled: false,
  depositBps: null,
}

describe('常规字段与敏感字段的分流', () => {
  it('常规字段直接生效', () => {
    const result = splitCustomerChanges(BEFORE, { level: 'A 类', name: '苏州明泰自动化' })

    expect(result.direct).toEqual({ level: 'A 类', name: '苏州明泰自动化' })
    expect(result.sensitive).toEqual([])
  })

  it('银行账号与付款条件走审批', () => {
    const result = splitCustomerChanges(BEFORE, {
      bankAccount: '6222 1111 1111 1111',
      paymentTerm: 'NET_30',
    })

    expect(result.direct).toEqual({})
    expect(result.sensitive.map((change) => change.field)).toEqual(['bankAccount', 'paymentTerm'])
    expect(result.sensitive[0]?.label).toBe('银行账号')
    expect(result.sensitive[1]).toMatchObject({ before: 'NET_60', after: 'NET_30' })
  })

  it('香港勾选属于敏感字段', () => {
    const result = splitCustomerChanges(BEFORE, { hkPricingEnabled: true })
    expect(result.sensitive[0]).toMatchObject({
      field: 'hkPricingEnabled',
      label: '香港 70% 价格勾选',
      before: false,
      after: true,
    })
  })

  it('一次改动可以同时含两类字段', () => {
    const result = splitCustomerChanges(BEFORE, { level: 'A 类', bankAccount: '6222 9999' })

    expect(Object.keys(result.direct)).toEqual(['level'])
    expect(result.sensitive).toHaveLength(1)
  })
})

describe('只比对真正变化的字段', () => {
  it('值没变不生成审批单', () => {
    const result = splitCustomerChanges(BEFORE, {
      bankAccount: '6222 0000 0000 0000',
      level: 'B 类',
    })

    expect(result.direct).toEqual({})
    expect(result.sensitive).toEqual([])
  })

  it('undefined 表示本次不改该字段', () => {
    const result = splitCustomerChanges(BEFORE, { level: undefined, bankAccount: undefined })
    expect(result.direct).toEqual({})
    expect(result.sensitive).toEqual([])
  })

  it('null 与「空字符串」是不同的改动', () => {
    const result = splitCustomerChanges(BEFORE, { depositBps: 3000 })
    expect(result.sensitive[0]).toMatchObject({ before: null, after: 3000 })
  })

  it('非标量值被规整成字符串，避免 JSON 里塞进对象', () => {
    const result = splitCustomerChanges(BEFORE, { level: { nested: true } as never })
    expect(typeof result.direct.level).toBe('string')
  })
})

describe('审批通过后的还原与文案', () => {
  it('变更清单还原成可落库的 patch', () => {
    const { sensitive } = splitCustomerChanges(BEFORE, { bankAccount: '6222 9999', paymentTerm: 'NET_30' })
    expect(changesToPatch(sensitive)).toEqual({ bankAccount: '6222 9999', paymentTerm: 'NET_30' })
  })

  it('文案用中文标签，空值显示「（空）」', () => {
    const { sensitive } = splitCustomerChanges(BEFORE, { depositBps: 3000 })
    expect(describeChanges(sensitive)).toBe('预付比例：（空） → 3000')
  })

  it('多项变更用分号连接', () => {
    const { sensitive } = splitCustomerChanges(BEFORE, { bankAccount: '6222 9999', paymentTerm: 'NET_30' })
    expect(describeChanges(sensitive)).toContain('；')
  })
})
