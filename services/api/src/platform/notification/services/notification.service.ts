import { Inject, Injectable } from '@nestjs/common'

import {
  NOTIFICATION_REPOSITORY,
  type NotificationInput,
  type NotificationRecord,
  type NotificationRepositoryPort,
} from '../repositories/notification.repository.port'

/**
 * 统一通知（工作台通知流的唯一写入口）。
 * 业务模块只调用本服务，禁止各自建通知表。
 */
@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repository: NotificationRepositoryPort,
  ) {}

  notify(input: NotificationInput): Promise<NotificationRecord> {
    return this.repository.create(input)
  }

  /** 广播给一组责任人（如「账户申请待审批」派给全部 IT 管理员）。 */
  notifyMany(recipients: readonly string[], input: Omit<NotificationInput, 'recipientUserCode'>): Promise<number> {
    return this.repository.createMany(
      recipients.map((recipientUserCode) => ({ ...input, recipientUserCode })),
    )
  }

  listUnread(recipientUserCode: string, limit = 50): Promise<NotificationRecord[]> {
    return this.repository.listUnread(recipientUserCode, limit)
  }

  markRead(id: string, recipientUserCode: string): Promise<void> {
    return this.repository.markRead(id, recipientUserCode)
  }
}
