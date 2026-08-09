import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type { AuditLogEntry, AuditLogRepositoryPort } from './audit-log.repository.port'
import type { Prisma } from '@prisma/client'



function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined
  return value as Prisma.InputJsonValue
}

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async append(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserCode: entry.actorUserCode,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: toJson(entry.before),
        after: toJson(entry.after),
        ip: entry.ip ?? null,
        traceId: entry.traceId ?? null,
      },
    })
  }
}
