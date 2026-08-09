import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  NotificationInput,
  NotificationRecord,
  NotificationRepositoryPort,
} from './notification.repository.port'


@Injectable()
export class PrismaNotificationRepository implements NotificationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  create(input: NotificationInput): Promise<NotificationRecord> {
    return this.prisma.notification.create({ data: { ...input } })
  }

  async createMany(inputs: NotificationInput[]): Promise<number> {
    if (inputs.length === 0) return 0
    const result = await this.prisma.notification.createMany({ data: inputs })
    return result.count
  }

  listUnread(recipientUserCode: string, limit: number): Promise<NotificationRecord[]> {
    return this.prisma.notification.findMany({
      where: { recipientUserCode, readAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async markRead(id: string, recipientUserCode: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, recipientUserCode, readAt: null },
      data: { readAt: new Date() },
    })
  }
}
