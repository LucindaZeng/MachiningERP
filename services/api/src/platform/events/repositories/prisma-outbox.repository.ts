import { Injectable } from '@nestjs/common'


import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type { OutboxRepositoryPort } from './outbox.repository.port'
import type { DomainEvent } from '../events/domain-event'
import type { Prisma } from '@prisma/client'

@Injectable()
export class PrismaOutboxRepository implements OutboxRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async append(event: DomainEvent): Promise<void> {
    await this.prisma.outboxEvent.create({
      data: {
        eventId: event.eventId,
        name: event.name,
        payload: event.payload as Prisma.InputJsonValue,
        occurredAt: event.occurredAt,
        traceId: event.traceId ?? null,
      },
    })
  }

  async listUnpublished(limit: number): Promise<DomainEvent[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { occurredAt: 'asc' },
      take: limit,
    })

    return rows.map((row) => ({
      eventId: row.eventId,
      name: row.name,
      occurredAt: row.occurredAt,
      traceId: row.traceId,
      payload: (row.payload ?? {}) as Record<string, unknown>,
    }))
  }

  async markPublished(eventId: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { eventId },
      data: { publishedAt: new Date() },
    })
  }

  async markFailed(eventId: string, error: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { eventId },
      data: { attempts: { increment: 1 }, lastError: error.slice(0, 500) },
    })
  }
}
