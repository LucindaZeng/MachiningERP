import { Global, Module } from '@nestjs/common'

import { NOTIFICATION_REPOSITORY } from './repositories/notification.repository.port'
import { PrismaNotificationRepository } from './repositories/prisma-notification.repository'
import { NotificationService } from './services/notification.service'

@Global()
@Module({
  providers: [
    NotificationService,
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
