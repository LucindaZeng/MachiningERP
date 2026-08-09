import { Global, Module } from '@nestjs/common'

import { OUTBOX_REPOSITORY } from './repositories/outbox.repository.port'
import { PrismaOutboxRepository } from './repositories/prisma-outbox.repository'
import { DomainEventPublisher } from './services/domain-event-publisher.service'

@Global()
@Module({
  providers: [
    DomainEventPublisher,
    { provide: OUTBOX_REPOSITORY, useClass: PrismaOutboxRepository },
  ],
  exports: [DomainEventPublisher],
})
export class EventsModule {}
