import { randomUUID } from 'node:crypto'

import { Inject, Injectable, Logger } from '@nestjs/common'

import {
  OUTBOX_REPOSITORY,
  type OutboxRepositoryPort,
} from '../repositories/outbox.repository.port'

import type { DomainEvent, DomainEventName } from '../events/domain-event'

export type DomainEventHandler = (event: DomainEvent) => void | Promise<void>

export interface PublishInput<TPayload extends Record<string, unknown>> {
  name: DomainEventName
  payload: TPayload
  traceId?: string | null
  occurredAt?: Date
}

/**
 * 领域事件发布：先落出箱表（事实来源、可重放），再在进程内派发给订阅方。
 * 跨模块协作只走本通道或对方 index.ts 导出，禁止 import 别人的内部文件。
 */
@Injectable()
export class DomainEventPublisher {
  private readonly logger = new Logger(DomainEventPublisher.name)
  private readonly handlers = new Map<string, DomainEventHandler[]>()

  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outbox: OutboxRepositoryPort,
  ) {}

  subscribe(name: DomainEventName, handler: DomainEventHandler): void {
    const existing = this.handlers.get(name) ?? []
    existing.push(handler)
    this.handlers.set(name, existing)
  }

  async publish<TPayload extends Record<string, unknown>>(
    input: PublishInput<TPayload>,
  ): Promise<DomainEvent<TPayload>> {
    const event: DomainEvent<TPayload> = {
      eventId: randomUUID(),
      name: input.name,
      occurredAt: input.occurredAt ?? new Date(),
      traceId: input.traceId ?? null,
      payload: input.payload,
    }

    await this.outbox.append(event as DomainEvent)
    await this.dispatch(event as DomainEvent)
    return event
  }

  private async dispatch(event: DomainEvent): Promise<void> {
    for (const handler of this.handlers.get(event.name) ?? []) {
      try {
        await handler(event)
      } catch (error) {
        // 订阅方失败不回滚主业务，但必须留痕并计入重试次数
        this.logger.error(
          `事件订阅方处理失败：${event.name}`,
          error instanceof Error ? error.stack : String(error),
        )
        await this.outbox.markFailed(event.eventId, String(error))
      }
    }
  }
}
