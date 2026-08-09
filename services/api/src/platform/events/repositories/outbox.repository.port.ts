import type { DomainEvent } from '../events/domain-event'

export interface OutboxRepositoryPort {
  append(event: DomainEvent): Promise<void>
  listUnpublished(limit: number): Promise<DomainEvent[]>
  markPublished(eventId: string): Promise<void>
  markFailed(eventId: string, error: string): Promise<void>
}

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY')
