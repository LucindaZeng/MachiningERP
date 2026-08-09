import { NotificationService } from '../services/notification.service'

import type {
  NotificationInput,
  NotificationRecord,
  NotificationRepositoryPort,
} from '../repositories/notification.repository.port'

class FakeNotificationRepository implements NotificationRepositoryPort {
  readonly rows: NotificationRecord[] = []

  async create(input: NotificationInput): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      id: `n-${this.rows.length + 1}`,
      ...input,
      readAt: null,
      createdAt: new Date('2026-08-08T10:00:00Z'),
    }
    this.rows.push(record)
    return record
  }

  async createMany(inputs: NotificationInput[]): Promise<number> {
    for (const input of inputs) await this.create(input)
    return inputs.length
  }

  async listUnread(recipientUserCode: string, limit: number): Promise<NotificationRecord[]> {
    return this.rows
      .filter((row) => row.recipientUserCode === recipientUserCode && row.readAt === null)
      .slice(0, limit)
  }

  async markRead(id: string, recipientUserCode: string): Promise<void> {
    const row = this.rows.find(
      (item) => item.id === id && item.recipientUserCode === recipientUserCode,
    )
    if (row) row.readAt = new Date()
  }
}

const BASE = { category: 'BOM_REQUEST', title: 'BOM 建立完成', body: null, link: null }

describe('通知', () => {
  it('单发', async () => {
    const repository = new FakeNotificationRepository()
    const service = new NotificationService(repository)

    const record = await service.notify({ ...BASE, recipientUserCode: 'WFX-2018-0042' })
    expect(record.recipientUserCode).toBe('WFX-2018-0042')
  })

  it('广播给一组责任人（如全部 IT 管理员）', async () => {
    const repository = new FakeNotificationRepository()
    const service = new NotificationService(repository)

    const count = await service.notifyMany(['WFX-2019-0001', 'WFX-2019-0002'], BASE)
    expect(count).toBe(2)
    expect(repository.rows.map((row) => row.recipientUserCode)).toEqual([
      'WFX-2019-0001',
      'WFX-2019-0002',
    ])
  })

  it('收件人为空时不产生通知', async () => {
    const service = new NotificationService(new FakeNotificationRepository())
    expect(await service.notifyMany([], BASE)).toBe(0)
  })

  it('未读列表按收件人隔离，已读不再出现', async () => {
    const repository = new FakeNotificationRepository()
    const service = new NotificationService(repository)

    const mine = await service.notify({ ...BASE, recipientUserCode: 'WFX-2018-0042' })
    await service.notify({ ...BASE, recipientUserCode: 'WFX-2019-0001' })

    expect(await service.listUnread('WFX-2018-0042')).toHaveLength(1)
    await service.markRead(mine.id, 'WFX-2018-0042')
    expect(await service.listUnread('WFX-2018-0042')).toHaveLength(0)
  })

  it('limit 可显式指定', async () => {
    const repository = new FakeNotificationRepository()
    const service = new NotificationService(repository)
    await service.notifyMany(['WFX-2018-0042', 'WFX-2018-0042', 'WFX-2018-0042'], BASE)

    expect(await service.listUnread('WFX-2018-0042', 2)).toHaveLength(2)
  })
})
