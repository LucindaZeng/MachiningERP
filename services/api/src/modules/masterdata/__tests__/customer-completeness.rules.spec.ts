import {
  checkCustomerCompleteness,
  type CustomerCompletenessSnapshot,
} from '../services/customer-completeness.rules'

const READY: CustomerCompletenessSnapshot = {
  status: 'ACTIVE',
  region: 'DOMESTIC',
  taxNo: '91320500MA1XXXXX',
  invoiceAddress: '苏州市工业园区 XX 路 8 号',
  bankAccount: '6222 0000 0000 0000',
  paymentTerm: 'NET_60',
  invoiceType: 'SPECIAL',
  salesUserCode: 'WFX-2018-0042',
  deliveryAddressCount: 2,
  hasDefaultDeliveryAddress: true,
}

describe('下单前档案完整性', () => {
  it('齐全的国内客户可以下单', () => {
    expect(checkCustomerCompleteness(READY)).toEqual({ ready: true, missing: [] })
  })

  it('报价阶段的草稿档案给出可读提示，而不是干巴巴的字段名', () => {
    const result = checkCustomerCompleteness({ ...READY, status: 'DRAFT' })
    expect(result.ready).toBe(false)
    expect(result.missing[0]).toContain('报价阶段的临时档案')
  })

  it('非 ACTIVE 的其它状态也拦下', () => {
    const result = checkCustomerCompleteness({ ...READY, status: 'SUSPENDED' })
    expect(result.ready).toBe(false)
    expect(result.missing[0]).toContain('SUSPENDED')
  })

  it.each([
    ['发票地址', { invoiceAddress: null }],
    ['银行账号', { bankAccount: '  ' }],
    ['负责对接的业务人员', { salesUserCode: null }],
  ])('缺 %s 时列进缺失清单', (label, patch) => {
    expect(checkCustomerCompleteness({ ...READY, ...patch }).missing).toContain(label)
  })

  it('国内客户缺税号拦下，国外客户不拦', () => {
    expect(checkCustomerCompleteness({ ...READY, taxNo: null }).missing).toContain(
      '税号（国内客户必填）',
    )
    expect(
      checkCustomerCompleteness({ ...READY, region: 'OVERSEAS', taxNo: null }).ready,
    ).toBe(true)
  })

  it('付款条件与发票种类缺失分别拦下', () => {
    expect(checkCustomerCompleteness({ ...READY, paymentTerm: null }).missing).toContain('付款条件')
    expect(checkCustomerCompleteness({ ...READY, invoiceType: null }).missing).toContain('发票种类')
  })

  it('一个送货地址都没有 vs 有地址但没默认，提示不同', () => {
    expect(
      checkCustomerCompleteness({ ...READY, deliveryAddressCount: 0, hasDefaultDeliveryAddress: false })
        .missing,
    ).toContain('送货地址（至少 1 个）')

    expect(
      checkCustomerCompleteness({ ...READY, hasDefaultDeliveryAddress: false }).missing,
    ).toContain('默认送货地址')
  })

  it('多项缺失时全部列出，供下单拦截一次性提示', () => {
    const result = checkCustomerCompleteness({
      status: 'DRAFT',
      region: 'DOMESTIC',
      taxNo: null,
      invoiceAddress: null,
      bankAccount: null,
      paymentTerm: null,
      invoiceType: null,
      salesUserCode: null,
      deliveryAddressCount: 0,
      hasDefaultDeliveryAddress: false,
    })

    expect(result.ready).toBe(false)
    expect(result.missing.length).toBeGreaterThanOrEqual(7)
  })
})
