import { Inject, Injectable, Logger } from '@nestjs/common'

import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogEntry,
  type AuditLogRepositoryPort,
} from '../repositories/audit-log.repository.port'

/**
 * 统一审计（api-conventions.md「审计与计时」）。
 * 审计失败不得影响主业务，但必须留下告警日志——禁止静默吞掉。
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly repository: AuditLogRepositoryPort,
  ) {}

  async record(entry: AuditLogEntry): Promise<void> {
    try {
      await this.repository.append(entry)
    } catch (error) {
      this.logger.error(
        `审计写入失败：${entry.action} ${entry.entityType}#${entry.entityId ?? '-'}`,
        error instanceof Error ? error.stack : String(error),
      )
    }
  }
}
