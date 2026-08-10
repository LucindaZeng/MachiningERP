import { OrderFulfilmentService, nextOrderStatus } from '../services/order-fulfilment.service'

import type { DomainEventPublisher } from '../../../platform/events'
import type {
  SalesOrderRecord,
  SalesOrderRepositoryPort,
} from '../repositories/sales-order.repository.port'
import type { SalesOrderStatus } from '@prisma/client'

function order(status: SalesOrderStatus): SalesOrderRecord {
  return { id: 'O1', docNo: 'SO-1', status, versionLock: 2 } as SalesOrderRecord
}

function build(record: SalesOrderRecord | null): {
  service: OrderFulfilmentService
  updateStatus: jest.Mock
  fire: (payload: Record<string, unknown>) => Promise<void>
} {
  const updateStatus = jest.fn().mockResolvedValue(record)
  const orders = {
    findById: jest.fn().mockResolvedValue(record),
    updateStatus,
  } as unknown as SalesOrderRepositoryPort

  const handlers: Array<(event: { payload: unknown }) => void> = []
  const events = {
    subscribe: (_name: string, handler: (event: { payload: unknown }) => void) =>
      handlers.push(handler),
  } as unknown as DomainEventPublisher

  const service = new OrderFulfilmentService(events, orders)
  service.onModuleInit()

  return {
    service,
    updateStatus,
    fire: async (payload) => {
      await service.apply(payload)
    },
  }
}

describe('部分出货 → EXECUTING，全部发齐 → COMPLETED', () => {
  it.each<[SalesOrderStatus, boolean, SalesOrderStatus | null]>([
    ['APPROVED', false, 'EXECUTING'],
    ['APPROVED', true, 'COMPLETED'],
    ['EXECUTING', false, null],
    ['EXECUTING', true, 'COMPLETED'],
    // 还没批准就出货是流程被绕过的信号，不是出货该顺手修的
    ['DRAFT', true, null],
    ['MANAGER_REVIEW', true, null],
    // 已完成 / 已关闭的订单不往回退
    ['COMPLETED', true, null],
    ['CLOSED', true, null],
  ])('%s + 发齐=%s → %s', (current, allShipped, expected) => {
    expect(nextOrderStatus(current, allShipped)).toBe(expected)
  })
})

describe('订阅 shipment.posted 后回写订单', () => {
  it('没有 orderId 的事件直接忽略', async () => {
    const { updateStatus, fire } = build(order('APPROVED'))
    await fire({})

    expect(updateStatus).not.toHaveBeenCalled()
  })

  it('订单不存在时只记日志，不抛错卡住事件循环', async () => {
    const { updateStatus, fire } = build(null)
    await expect(fire({ orderId: 'GONE', docNo: 'SHP-1' })).resolves.toBeUndefined()

    expect(updateStatus).not.toHaveBeenCalled()
  })

  it('部分出货把已批准的订单推进执行中', async () => {
    const { updateStatus, fire } = build(order('APPROVED'))
    await fire({ orderId: 'O1', allLinesFullyShipped: false })

    expect(updateStatus).toHaveBeenCalledWith('O1', 2, {
      status: 'EXECUTING',
      updatedBy: 'system:shipment',
    })
  })

  it('全部发齐时置为已完成', async () => {
    const { updateStatus, fire } = build(order('EXECUTING'))
    await fire({ orderId: 'O1', allLinesFullyShipped: true })

    expect(updateStatus).toHaveBeenCalledWith('O1', 2, expect.objectContaining({ status: 'COMPLETED' }))
  })

  it('已经在执行中且没发齐时什么都不做', async () => {
    const { updateStatus, fire } = build(order('EXECUTING'))
    await fire({ orderId: 'O1', allLinesFullyShipped: false })

    expect(updateStatus).not.toHaveBeenCalled()
  })

  it('乐观锁冲突不抛错——下一张出货单过账时会再算一次', async () => {
    const orders = {
      findById: jest.fn().mockResolvedValue(order('APPROVED')),
      updateStatus: jest.fn().mockResolvedValue(null),
    } as unknown as SalesOrderRepositoryPort
    const events = { subscribe: jest.fn() } as unknown as DomainEventPublisher

    const service = new OrderFulfilmentService(events, orders)
    await expect(service.apply({ orderId: 'O1', docNo: 'SHP-1' })).resolves.toBeUndefined()
  })

  it('onModuleInit 之后事件到达能走通整条链', async () => {
    const { updateStatus, service } = build(order('APPROVED'))
    await service.apply({ orderId: 'O1', allLinesFullyShipped: true })

    expect(updateStatus).toHaveBeenCalled()
  })
})
