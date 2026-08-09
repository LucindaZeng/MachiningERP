export interface AuditLogEntry {
  /** 责任人一律记唯一编码，不记用户名（用户名可被复用） */
  actorUserCode: string | null
  action: string
  entityType: string
  entityId?: string | null
  before?: unknown
  after?: unknown
  ip?: string | null
  traceId?: string | null
}

export interface AuditLogRepositoryPort {
  append(entry: AuditLogEntry): Promise<void>
}

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY')
