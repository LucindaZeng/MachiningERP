import { PERMISSION_CODES } from '@machining-erp/shared'

import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DocNumberService } from '../../../platform/numbering'
import { OrderChangeRequestService } from '../services/order-change-request.service'
import { toOrderChangeView } from '../services/order-change-view.mapper'

import { FakeOrderChangeRequestRepository } from './fakes'
import { MANAGER, READY_CONTEXT, SALES, buildHarness, draft } from './harness'

import type { SubmitOrderChangeInput } from '../services/order-change-request.service'

let docSeq = 0

function build(): {
  service: OrderChangeRequestService
  repo: FakeOrderChangeRequestRepository
  notify: jest.Mock
  createOrder: () => Promise<string>
} {
  const harness = buildHarness()
  const repo = new FakeOrderChangeRequestRepository()
  const notify = jest.fn().mockResolvedValue(undefined)

  const service = new OrderChangeRequestService(
    {
      next: jest.fn(async () => `OCR${String((docSeq += 1)).padStart(4, '0')}`),
    } as unknown as DocNumberService,
    { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
    { notify } as unknown as NotificationService,
    harness.orders,
    repo,
  )

  const createOrder = async (): Promise<string> => {
    const created = await harness.orders.create(draft(), READY_CONTEXT, SALES)
    return created.id
  }

  return { service, repo, notify, createOrder }
}

function input(orderId: string, overrides: Partial<SubmitOrderChangeInput> = {}): SubmitOrderChangeInput {
  return {
    orderId,
    orderLineId: null,
    changeType: 'QUANTITY',
    origin: 'customer',
    urgent: false,
    beforeValue: '100',
    afterValue: '120',
    reason: '客户追加数量',
    costOwner: '客户承担',
    ...overrides,
  }
}

describe('可改范围是白名单（业务规格 4.6）', () => {
  it('数量、交期、收货信息、包装、取消这五种可以提', async () => {
    const { service, createOrder } = build()
    const orderId = await createOrder()

    for (const changeType of ['QUANTITY', 'DELIVERY', 'SHIP_TO', 'PACKING', 'CANCEL']) {
      const record = await service.submit(input(orderId, { changeType }), SALES)
      expect(record.changeType).toBe(changeType)
    }
  })

  it('改价格被挡下，并指路到报价单修改申请', () => {
    expect(() => OrderChangeRequestService.assertChangeType('price')).toThrow(/报价单修改申请/)
  })

  it('换产品被挡下', () => {
    expect(() => OrderChangeRequestService.assertChangeType('product')).toThrow(/报价单修改申请/)
  })

  it('改图纸、改材料、改表处指路到 ECN', () => {
    for (const intent of ['drawing', 'material', 'finishing']) {
      expect(() => OrderChangeRequestService.assertChangeType(intent)).toThrow(/ECN/)
    }
  })

  it('不认识的类型给出可改范围清单，而不是含糊拒绝', () => {
    expect(() => OrderChangeRequestService.assertChangeType('whatever')).toThrow(
      /只能改数量、交期、收货信息、包装或取消订单/,
    )
  })

  it('错误码统一是 ORD_2030', async () => {
    const { service, createOrder } = build()
    const orderId = await createOrder()

    await expect(
      service.submit(input(orderId, { changeType: 'PRICE' }), SALES),
    ).rejects.toMatchObject({ code: 'ORD_2030', status: 422 })
  })

  it('details 里带上正确去处，前端可直接跳转', async () => {
    const { service, createOrder } = build()
    const orderId = await createOrder()

    const error = await service
      .submit(input(orderId, { changeType: 'price' }), SALES)
      .then(() => null)
      .catch((caught: unknown) => caught as { details: { redirect: string | null } })

    expect(error?.details.redirect).toContain('报价单修改申请')
  })
})

describe('提交', () => {
  it('取号、留痕、初始为已提交', async () => {
    const { service, createOrder } = build()
    const record = await service.submit(input(await createOrder()), SALES)

    expect(record.requestNo).toMatch(/^OCR/)
    expect(record.status).toBe('SUBMITTED')
    expect(record.submittedBy).toBe(SALES.userCode)
  })

  it('不写原因不给提', async () => {
    const { service, createOrder } = build()
    const orderId = await createOrder()

    await expect(
      service.submit(input(orderId, { reason: '   ' }), SALES),
    ).rejects.toMatchObject({ code: 'ORD_2005' })
  })

  it('订单不存在时不落单', async () => {
    const { service, repo } = build()

    await expect(service.submit(input('nope'), SALES)).rejects.toMatchObject({ code: 'ORD_2000' })
    expect(repo.rows).toHaveLength(0)
  })

  it('非业务岗位提不了', async () => {
    const { service, createOrder } = build()
    const orderId = await createOrder()

    await expect(service.submit(input(orderId), MANAGER)).rejects.toMatchObject({
      code: 'ORD_2012',
    })
  })
})

describe('处理', () => {
  it('业务经理批准后记下处理人', async () => {
    const { service, createOrder } = build()
    const record = await service.submit(input(await createOrder()), SALES)

    const approved = await service.approve(record.id, record.versionLock, MANAGER)
    expect(approved.status).toBe('APPROVED')
    expect(approved.handledBy).toBe(MANAGER.userCode)
  })

  it('驳回理由必填且原样回到提交人', async () => {
    const { service, notify, createOrder } = build()
    const record = await service.submit(input(await createOrder()), SALES)

    const rejected = await service.reject(record.id, record.versionLock, '  产能排不开  ', MANAGER)

    expect(rejected.rejectReason).toBe('产能排不开')
    expect(notify).toHaveBeenLastCalledWith(
      expect.objectContaining({
        recipientUserCode: SALES.userCode,
        body: '驳回理由：产能排不开',
      }),
    )
  })

  it('空白理由报 ORD_2033', async () => {
    const { service, createOrder } = build()
    const record = await service.submit(input(await createOrder()), SALES)

    await expect(
      service.reject(record.id, record.versionLock, '  ', MANAGER),
    ).rejects.toMatchObject({ code: 'ORD_2033' })
  })

  it('业务员处理不了自己的申请', async () => {
    const { service, createOrder } = build()
    const record = await service.submit(input(await createOrder()), SALES)

    await expect(service.approve(record.id, record.versionLock, SALES)).rejects.toMatchObject({
      code: 'ORD_2013',
    })
  })

  it('处理过的申请不能再处理一次', async () => {
    const { service, createOrder } = build()
    const record = await service.submit(input(await createOrder()), SALES)
    const approved = await service.approve(record.id, record.versionLock, MANAGER)

    await expect(
      service.reject(approved.id, approved.versionLock, '再想想', MANAGER),
    ).rejects.toMatchObject({ code: 'ORD_2032' })
  })

  it('版本号对不上按已处理拒绝', async () => {
    const { service, createOrder } = build()
    const record = await service.submit(input(await createOrder()), SALES)

    await expect(
      service.approve(record.id, record.versionLock + 5, MANAGER),
    ).rejects.toMatchObject({ code: 'ORD_2032' })
  })

  it('申请不存在报 ORD_2031', async () => {
    const { service } = build()
    await expect(service.load('nope')).rejects.toMatchObject({ code: 'ORD_2031' })
  })
})

describe('对外表示', () => {
  it('变更类型附中文标签，时间转 ISO', async () => {
    const { service, createOrder } = build()
    const record = await service.submit(
      input(await createOrder(), { changeType: 'DELIVERY' }),
      SALES,
    )

    const view = toOrderChangeView(record)
    expect(view.changeTypeLabel).toBe('交期')
    expect(view.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(view.handledAt).toBeNull()
  })

  it('业务经理权限点就是订单审核那一个', () => {
    expect(MANAGER.permissions).toContain(PERMISSION_CODES.ORDER_APPROVE)
  })

  it('按订单能列出全部申请', async () => {
    const { service, createOrder } = build()
    const orderId = await createOrder()
    await service.submit(input(orderId), SALES)
    await service.submit(input(orderId, { changeType: 'DELIVERY' }), SALES)

    expect(await service.listByOrder(orderId)).toHaveLength(2)
    expect(await service.listByOrder('other')).toHaveLength(0)
  })
})
