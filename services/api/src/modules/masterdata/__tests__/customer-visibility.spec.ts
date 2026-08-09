import { PERMISSION_CODES } from '@machining-erp/shared'

import { toCustomerView, toCustomerViews, type Viewer } from '../services/customer-visibility'

import type { CustomerRecord } from '../repositories/customer.repository.port'

const RECORD: CustomerRecord = {
  id: 'CU1',
  code: 'C0001',
  name: '香港宏晟精密有限公司',
  shortName: '香港宏晟',
  region: 'OVERSEAS',
  country: '中国香港',
  englishName: 'Hong Shing Precision Ltd.',
  englishAddress: '12/F, Kwai Chung Industrial Building, N.T., Hong Kong',
  ownerName: '李启明',
  ownerPhone: '+852 2345 6789',
  ownerEmail: 'km.lee@hongshing.com.hk',
  salesUserCode: 'WFX-2018-0042',
  taxNo: '91440300MA5XXXX881',
  invoiceAddress: '香港新界葵涌工业大厦 12 楼',
  bankAccount: '6222020000004417',
  bankName: '中国银行东莞分行',
  paymentTerm: 'NET_60',
  depositBps: null,
  invoiceType: 'SPECIAL',
  settlement: 'NOTE',
  currency: 'CNY',
  tradeTerm: 'FOB 深圳',
  level: 'A 类战略客户',
  hkPricingEnabled: true,
  hkFactorBps: 7000,
  hkEffectiveFrom: new Date('2026-01-01T00:00:00Z'),
  hkAppliedBy: 'WFX-2018-0042',
  hkApprovedBy: 'WFX-2016-0007',
  hkChangeReason: '香港代生产协议 2026 年续签',
  status: 'ACTIVE',
  approvedBy: 'WFX-2016-0007',
  creditLimitMinor: 120_000_000n,
  creditUsedMinor: 74_250_000n,
  overdueAmountMinor: 0n,
  arDays: 60,
  addresses: [
    {
      id: 'A1',
      label: '总仓',
      receiver: '陈仓管',
      phone: '+852 9000 0000',
      address: '葵涌工业大厦 3 楼',
      isDefault: true,
      sortOrder: 0,
    },
  ],
  createdBy: 'WFX-2018-0042',
  updatedAt: new Date('2026-08-08T10:00:00Z'),
  version: 3,
}

const salesManager: Viewer = {
  userCode: 'WFX-2018-0042',
  permissions: [PERMISSION_CODES.HK_PRICE_VIEW, PERMISSION_CODES.CUSTOMER_FINANCE_VIEW],
}
const salesRep: Viewer = { userCode: 'WFX-2020-0088', permissions: [] }

describe('香港 70% 价格是独立权限点', () => {
  it('授权人员能看到勾选、系数与审批留痕', () => {
    const view = toCustomerView(RECORD, salesManager)

    expect(view.hk).toEqual({
      pricingEnabled: true,
      factor: 0.7,
      effectiveFrom: '2026-01-01',
      appliedBy: 'WFX-2018-0042',
      approvedBy: 'WFX-2016-0007',
      changeReason: '香港代生产协议 2026 年续签',
    })
  })

  it('未授权者拿到的返回体里 hk 整组**缺席**，而不是给 false', () => {
    const view = toCustomerView(RECORD, salesRep)

    expect(view.hk).toBeUndefined()
    expect('hk' in view).toBe(false)
  })

  it('序列化后不含任何 hk 字段与系数——列表、报表与导出复用同一出口', () => {
    const json = JSON.stringify(toCustomerView(RECORD, salesRep))
    const parsed = JSON.parse(json) as Record<string, unknown>

    // 注意不能直接 json.not.toContain('hk')：联系人邮箱是 .hk 顶级域名，会误报
    expect(Object.keys(parsed).some((key) => key.toLowerCase().startsWith('hk'))).toBe(false)
    expect(json).not.toContain('7000')
    expect(json).not.toContain('代生产协议')
    expect(json).not.toContain('pricingEnabled')
  })

  it('列表出口与详情出口的裁剪一致', () => {
    const [view] = toCustomerViews([RECORD], salesRep)
    expect(view?.hk).toBeUndefined()

    const [privileged] = toCustomerViews([RECORD], salesManager)
    expect(privileged?.hk?.factor).toBe(0.7)
  })

  it('系数按万分比存整数，出口才转成小数，避免浮点误差', () => {
    const view = toCustomerView({ ...RECORD, hkFactorBps: 6667 }, salesManager)
    expect(view.hk?.factor).toBeCloseTo(0.6667, 10)
  })
})

describe('财务字段按权限打码', () => {
  it('有财务权限看明文', () => {
    const view = toCustomerView(RECORD, salesManager)
    expect(view.finance.taxNo).toBe('91440300MA5XXXX881')
    expect(view.finance.bankAccount).toBe('6222020000004417')
  })

  it('没有财务权限只看到后 4 位', () => {
    const view = toCustomerView(RECORD, salesRep)
    expect(view.finance.taxNo).toBe('**** **** X881')
    expect(view.finance.bankAccount).toBe('**** **** 4417')
  })

  it('空值不会被打码成假字符串', () => {
    const view = toCustomerView({ ...RECORD, taxNo: null, bankAccount: null }, salesRep)
    expect(view.finance.taxNo).toBeNull()
    expect(view.finance.bankAccount).toBeNull()
  })

  it('短到无可打码时原样返回', () => {
    const view = toCustomerView({ ...RECORD, bankAccount: '4417' }, salesRep)
    expect(view.finance.bankAccount).toBe('4417')
  })
})

describe('金额与比例的出口口径', () => {
  it('金额由整数分转成定点字符串 + 币种', () => {
    const view = toCustomerView(RECORD, salesManager)

    expect(view.finance.creditLimit).toEqual({ amount: '1200000.00', currency: 'CNY' })
    expect(view.finance.creditUsed).toEqual({ amount: '742500.00', currency: 'CNY' })
    expect(view.finance.overdueAmount).toEqual({ amount: '0.00', currency: 'CNY' })
  })

  it('预付比例按万分比转小数，无值时为 null', () => {
    expect(toCustomerView(RECORD, salesManager).depositRatio).toBeNull()
    expect(
      toCustomerView({ ...RECORD, depositBps: 3000 }, salesManager).depositRatio,
    ).toBeCloseTo(0.3, 10)
  })

  it('送货地址原样透出并保留默认标记', () => {
    const view = toCustomerView(RECORD, salesRep)
    expect(view.addresses).toEqual([
      {
        id: 'A1',
        label: '总仓',
        receiver: '陈仓管',
        phone: '+852 9000 0000',
        address: '葵涌工业大厦 3 楼',
        isDefault: true,
      },
    ])
  })
})
