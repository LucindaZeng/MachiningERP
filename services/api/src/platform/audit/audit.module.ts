import { Global, Module } from '@nestjs/common'

import { AUDIT_LOG_REPOSITORY } from './repositories/audit-log.repository.port'
import { PrismaAuditLogRepository } from './repositories/prisma-audit-log.repository'
import { AuditService } from './services/audit.service'

@Global()
@Module({
  providers: [AuditService, { provide: AUDIT_LOG_REPOSITORY, useClass: PrismaAuditLogRepository }],
  exports: [AuditService],
})
export class AuditModule {}
