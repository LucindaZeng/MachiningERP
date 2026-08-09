import { Logger } from '@nestjs/common'

import { DomainEventPublisher } from '../services/domain-event-publisher.service'

import type { DomainEvent } from '../events/domain-event'
import type { OutboxRepositoryPort } from '../repositories/outbox.repository.port'

class FakeOutbox implements OutboxRepositoryPort {
  readonly appended: DomainEvent[] = []
  readonly failures: Array<{ eventId: string; error: string }> = []
  readonly published: string[] = []

  async append(event: DomainEvent): Promise<void> {
    this.appended.push(event)
  }

  async listUnpublished(): Promise<DomainEvent[]> {
    return this.appended
  }

  async markPublished(eventId: string): Promise<void> {
    this.published.push(eventId)
  }

  async markFailed(eventId: string, error: string): Promise<void> {
    this.failures.push({ eventId, error })
  }
}

describe('领域事件发布', () => {
  it('先落出箱表（事实来源），再派发给订阅方', async () => {
    const outbox = new FakeOutbox()
    const publisher = new DomainEventPublisher(outbox)
    const handler = jest.fn()
    publisher.subscribe('order.sales-order.approved', handler)

    const event = await publisher.publish({
      name: 'order.sales-order.approved',
      payload: { docNo: 'SO202608080001' },
      traceId: 'trace-1',
    })

    expect(outbox.appended).toHaveLength(1)
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/)
    expect(event.traceId).toBe('trace-1')
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ name: 'order.sales-order.approved' }))
  })

  it('同一事件可以有多个订阅方', async () => {
    const publisher = new DomainEventPublisher(new FakeOutbox())
    const first = jest.fn()
    const second = jest.fn()
    publisher.subscribe('quotation.approved', first)
    publisher.subscribe('quotation.approved', second)

    await publisher.publish({ name: 'quotation.approved', payload: {} })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('没有订阅方时也能正常发布', async () => {
    const outbox = new FakeOutbox()
    const publisher = new DomainEventPublisher(outbox)

    await expect(publisher.publish({ name: 'nobody.listens', payload: {} })).resolves.toBeDefined()
    expect(outbox.appended).toHaveLength(1)
  })

  it('订阅方失败不回滚主业务，但要记录失败次数与日志', async () => {
    const outbox = new FakeOutbox()
    const publisher = new DomainEventPublisher(outbox)
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    publisher.subscribe('alert.raised', () => {
      throw new Error('handler exploded')
    })

    const event = await publisher.publish({ name: 'alert.raised', payload: {} })

    expect(outbox.failures).toEqual([
      { eventId: event.eventId, error: 'Error: handler exploded' },
    ])
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('occurredAt 可显式指定，缺省取当前时间', async () => {
    const publisher = new DomainEventPublisher(new FakeOutbox())
    const at = new Date('2026-08-08T10:00:00Z')

    expect((await publisher.publish({ name: 'x', payload: {}, occurredAt: at })).occurredAt).toBe(at)
    expect((await publisher.publish({ name: 'x', payload: {} })).occurredAt).toBeInstanceOf(Date)
  })
})
