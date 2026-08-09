export interface NotificationInput {
  /** 收件人一律用唯一编码，用户名可被复用不可作为收件标识 */
  recipientUserCode: string
  category: string
  title: string
  body?: string | null
  link?: string | null
  docType?: string | null
  docId?: string | null
}

export interface NotificationRecord extends NotificationInput {
  id: string
  readAt: Date | null
  createdAt: Date
}

export interface NotificationRepositoryPort {
  create(input: NotificationInput): Promise<NotificationRecord>
  createMany(inputs: NotificationInput[]): Promise<number>
  listUnread(recipientUserCode: string, limit: number): Promise<NotificationRecord[]>
  markRead(id: string, recipientUserCode: string): Promise<void>
}

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY')
