import { PERMISSION_CODES } from '@machining-erp/shared'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DocNumberService } from '../../../platform/numbering'
import { CustomerService } from '../services/customer.service'

import { BASE_CUSTOMER, FakeCustomerRepository } from './fakes'

import type { CreateCustomerInput } from '../services/customer-create-input'
import type { Viewer } from '../services/customer-visibility'


const OWNER: Viewer = { userCode: 'WFX-2018-0042', permissions: [PERMISSION_CODES.CUSTOMER_EDIT] }
const OTHER_REP: Viewer = { userCode: 'WFX-2020-0088', permissions: [] }
const MANAGER: Viewer = {
  userCode: 'WFX-2016-0007',
  permissions: [PERMISSION_CODES.CUSTOMER_VIEW_ALL],
}

const VALID_INPUT: CreateCustomerInput = {
  name: '东莞精锻五金有限公司',
  shortName: '东莞精锻',
  region: 'DOMESTIC',
  country: '中国',
  ownerName: '陈总',
  ownerPhone: '13700000000',
  taxNo: '91441900MA5XXXXX',
  invoiceAddress: '东莞市长安镇 XX 路 9 号',
  paymentTerm: 'NET_30',
  invoiceType: 'GENERAL',
  settlement: 'CASH',
  addresses: [
    {
      label: '总仓',
      receiver: '刘收货',
      phone: '13600000000',
      address: '东莞市长安镇 XX 路 9 号',
      isDefault: true,
    },
  ],
}

function build(seed = [BASE_CUSTOMER]): {
  service: CustomerService
  customers: FakeCustomerRepository
  next: jest.Mock
} {
  const customers = new FakeCustomerRepository(seed.map((row) => ({ ...row })))
  const next = jest.fn().mockResolvedValue('C0002')
  const service = new CustomerService(
    { next } as unknown as DocNumberService,
    { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
    customers,
  )
  return { service, customers, next }
}

describe('建客户档案', () => {
  it('编号由平台统一编号规则生成', async () => {
    const { service, next } = build([])
    const view = await service.create(VALID_INPUT, OWNER)

    expect(next).toHaveBeenCalledWith('CUS')
    expect(view.code).toBe('C0002')
  })

  it('未指定负责业务员时默认落到建档人', async () => {
    const { service } = build([])
    const view = await service.create(VALID_INPUT, OWNER)
    expect(view.salesUserCode).toBe('WFX-2018-0042')
  })

  it('同名客户拒绝重复建档', async () => {
    const { service } = build([{ ...BASE_CUSTOMER, name: VALID_INPUT.name }])
    await expect(service.create(VALID_INPUT, OWNER)).rejects.toMatchObject({ code: 'ORD_2102' })
  })

  it('校验不过时一次性给出全部问题', async () => {
    const { service } = build([])
    const error = await service
      .create({ ...VALID_INPUT, taxNo: null, ownerPhone: '' }, OWNER)
      .catch((caught: unknown) => caught as BizError)

    expect(error).toBeInstanceOf(BizError)
    expect((error as BizError).code).toBe('ORD_2101')
    expect((error as BizError).message).toContain('税号')
    expect((error as BizError).message).toContain('负责人电话')
  })

  it('报价阶段的新客户先建草稿', async () => {
    const { service } = build([])
    const view = await service.create({ ...VALID_INPUT, draft: true }, OWNER)
    expect(view.status).toBe('DRAFT')
  })

  it('勾选香港价格时记录申请人，供审计追责', async () => {
    const { service } = build([])
    const view = await service.create(
      {
        ...VALID_INPUT,
        hkPricingEnabled: true,
        hkFactorBps: 7000,
        hkEffectiveFrom: '2026-01-01',
        hkChangeReason: '代生产协议',
      },
      { ...OWNER, permissions: [...OWNER.permissions, PERMISSION_CODES.HK_PRICE_VIEW] },
    )

    expect(view.hk?.appliedBy).toBe('WFX-2018-0042')
  })
})

describe('数据权限在查询层强制注入', () => {
  it('普通业务员只看得到自己负责的客户', async () => {
    const { service } = build([
      BASE_CUSTOMER,
      { ...BASE_CUSTOMER, id: 'CU2', code: 'C0002', salesUserCode: 'WFX-2020-0088' },
    ])

    const mine = await service.list({ page: 1, pageSize: 50 }, OTHER_REP)
    expect(mine.total).toBe(1)
    expect(mine.items[0]?.code).toBe('C0002')
  })

  it('有 customer.view-all 的人看得到全部', async () => {
    const { service } = build([
      BASE_CUSTOMER,
      { ...BASE_CUSTOMER, id: 'CU2', code: 'C0002', salesUserCode: 'WFX-2020-0088' },
    ])

    expect((await service.list({ page: 1, pageSize: 50 }, MANAGER)).total).toBe(2)
  })

  it('越权访问详情返回 404 而不是 403，避免暴露客户存在性', async () => {
    const { service } = build()
    await expect(service.detail('CU1', OTHER_REP)).rejects.toMatchObject({
      code: 'ORD_2100',
      status: 404,
    })
  })

  it('不存在的 id 同样 404', async () => {
    const { service } = build()
    await expect(service.detail('MISSING', MANAGER)).rejects.toMatchObject({ code: 'ORD_2100' })
  })
})

describe('下单前的档案完整性闸门', () => {
  it('齐全时返回记录供下单继续', async () => {
    const { service } = build()
    await expect(service.assertReadyForOrder('C0001')).resolves.toMatchObject({ code: 'C0001' })
  })

  it('客户不存在直接拦下', async () => {
    const { service } = build([])
    await expect(service.assertReadyForOrder('C9999')).rejects.toMatchObject({ code: 'ORD_2100' })
  })

  it('档案不全时报错并在 details 里给出缺失项清单', async () => {
    const { service } = build([{ ...BASE_CUSTOMER, taxNo: null, bankAccount: null }])
    const error = (await service
      .assertReadyForOrder('C0001')
      .catch((caught: unknown) => caught)) as BizError

    expect(error.code).toBe('ORD_2104')
    expect(error.message).toContain('不能下单')
    expect((error.details as { missing: string[] }).missing).toEqual(
      expect.arrayContaining(['银行账号', '税号（国内客户必填）']),
    )
  })

  it('草稿客户不能下单', async () => {
    const { service } = build([{ ...BASE_CUSTOMER, status: 'DRAFT' }])
    await expect(service.assertReadyForOrder('C0001')).rejects.toMatchObject({ code: 'ORD_2104' })
  })

  it('completeness 端点复用同一套判定', async () => {
    const { service } = build([{ ...BASE_CUSTOMER, bankAccount: null }])
    const result = await service.completeness('CU1', MANAGER)

    expect(result.ready).toBe(false)
    expect(result.missing).toContain('银行账号')
  })
})
