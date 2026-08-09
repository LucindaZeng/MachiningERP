import {
  MAX_DELIVERY_ADDRESSES,
  validateCustomerProfile,
  type CustomerProfileInput,
} from '../services/customer-validation.rules'

function address(overrides: Partial<CustomerProfileInput['addresses'][number]> = {}) {
  return {
    label: '总仓',
    receiver: '王收货',
    phone: '13800000000',
    address: '东莞市长安镇 XX 路 1 号',
    isDefault: true,
    ...overrides,
  }
}

const DOMESTIC: CustomerProfileInput = {
  name: '苏州明泰自动化科技有限公司',
  shortName: '苏州明泰',
  region: 'DOMESTIC',
  country: '中国',
  ownerName: '张经理',
  ownerPhone: '13900000000',
  taxNo: '91320500MA1XXXXX',
  invoiceAddress: '苏州市工业园区 XX 路 8 号',
  paymentTerm: 'NET_60',
  invoiceType: 'SPECIAL',
  settlement: 'NOTE',
  addresses: [address()],
}

function fieldsOf(input: CustomerProfileInput): string[] {
  return validateCustomerProfile(input).map((issue) => issue.field)
}

describe('必填项', () => {
  it('完整的国内客户档案没有问题', () => {
    expect(validateCustomerProfile(DOMESTIC)).toEqual([])
  })

  it.each([
    ['name', { name: '  ' }],
    ['shortName', { shortName: '' }],
    ['country', { country: ' ' }],
    ['ownerName', { ownerName: '' }],
    ['ownerPhone', { ownerPhone: '' }],
    ['invoiceAddress', { invoiceAddress: '  ' }],
  ])('%s 缺失被拦下', (field, patch) => {
    expect(fieldsOf({ ...DOMESTIC, ...patch })).toContain(field)
  })

  it('一次返回全部问题，而不是遇错即停', () => {
    const issues = validateCustomerProfile({ ...DOMESTIC, name: '', shortName: '', ownerName: '' })
    expect(issues.length).toBeGreaterThanOrEqual(3)
  })
})

describe('国内客户必填税号', () => {
  it('国内客户没有税号被拦下', () => {
    expect(fieldsOf({ ...DOMESTIC, taxNo: null })).toContain('taxNo')
    expect(fieldsOf({ ...DOMESTIC, taxNo: '   ' })).toContain('taxNo')
  })

  it('国外客户不强制税号', () => {
    const overseas: CustomerProfileInput = {
      ...DOMESTIC,
      region: 'OVERSEAS',
      country: '德国',
      taxNo: null,
    }
    expect(validateCustomerProfile(overseas)).toEqual([])
  })
})

describe('付款条件与预付比例', () => {
  it('选「预付比例 + 出货前付清」必须给比例', () => {
    expect(fieldsOf({ ...DOMESTIC, paymentTerm: 'DEPOSIT_THEN_BALANCE' })).toContain('depositBps')
  })

  it('比例必须落在 0% 与 100% 之间（不含两端）', () => {
    const base = { ...DOMESTIC, paymentTerm: 'DEPOSIT_THEN_BALANCE' as const }
    expect(fieldsOf({ ...base, depositBps: 0 })).toContain('depositBps')
    expect(fieldsOf({ ...base, depositBps: 10_000 })).toContain('depositBps')
    expect(fieldsOf({ ...base, depositBps: -1 })).toContain('depositBps')
    expect(fieldsOf({ ...base, depositBps: 30.5 })).toContain('depositBps')
    expect(validateCustomerProfile({ ...base, depositBps: 3000 })).toEqual([])
  })

  it('其它付款条件不该带预付比例', () => {
    expect(fieldsOf({ ...DOMESTIC, paymentTerm: 'NET_30', depositBps: 3000 })).toContain('depositBps')
  })
})

describe('送货地址：最多 5 个且恰好一个默认', () => {
  it('最多 5 个', () => {
    const six = Array.from({ length: 6 }, (_, index) => address({ isDefault: index === 0 }))
    expect(fieldsOf({ ...DOMESTIC, addresses: six })).toContain('addresses')

    const five = Array.from({ length: MAX_DELIVERY_ADDRESSES }, (_, index) =>
      address({ isDefault: index === 0 }),
    )
    expect(validateCustomerProfile({ ...DOMESTIC, addresses: five })).toEqual([])
  })

  it('有地址就必须有且只有一个默认', () => {
    expect(fieldsOf({ ...DOMESTIC, addresses: [address({ isDefault: false })] })).toContain('addresses')
    expect(
      fieldsOf({ ...DOMESTIC, addresses: [address(), address({ label: '二仓' })] }),
    ).toContain('addresses')
  })

  it('一个地址都没有时不校验默认（报价阶段的草稿档案）', () => {
    expect(validateCustomerProfile({ ...DOMESTIC, addresses: [] })).toEqual([])
  })

  it('地址行内的收货人与详细地址必填', () => {
    const fields = fieldsOf({
      ...DOMESTIC,
      addresses: [address({ receiver: '', address: '  ' })],
    })
    expect(fields).toContain('addresses[0].receiver')
    expect(fields).toContain('addresses[0].address')
  })
})

describe('香港 70% 价格勾选', () => {
  const hk = { ...DOMESTIC, hkPricingEnabled: true, hkFactorBps: 7000 }

  it('勾选时必须给生效日期与变更理由（审计要求）', () => {
    const fields = fieldsOf(hk)
    expect(fields).toContain('hkEffectiveFrom')
    expect(fields).toContain('hkChangeReason')
  })

  it('齐全时通过', () => {
    expect(
      validateCustomerProfile({
        ...hk,
        hkEffectiveFrom: '2026-01-01',
        hkChangeReason: '香港代生产协议续签',
      }),
    ).toEqual([])
  })

  it('系数必须在 0% 与 100% 之间', () => {
    const full = { ...hk, hkEffectiveFrom: '2026-01-01', hkChangeReason: '协议' }
    expect(fieldsOf({ ...full, hkFactorBps: 0 })).toContain('hkFactorBps')
    expect(fieldsOf({ ...full, hkFactorBps: 10_001 })).toContain('hkFactorBps')
    expect(fieldsOf({ ...full, hkFactorBps: null })).toContain('hkFactorBps')
    // 100% 是合法的（等于不打折）
    expect(validateCustomerProfile({ ...full, hkFactorBps: 10_000 })).toEqual([])
  })

  it('未勾选时不校验香港相关字段', () => {
    expect(validateCustomerProfile({ ...DOMESTIC, hkPricingEnabled: false })).toEqual([])
  })
})
