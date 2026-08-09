import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type { DocNumberRepositoryPort, DocNumberRuleRecord } from './doc-number.repository.port'


@Injectable()
export class PrismaDocNumberRepository implements DocNumberRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findRule(docType: string): Promise<DocNumberRuleRecord | null> {
    const rule = await this.prisma.docNumberRule.findUnique({ where: { docType } })
    if (!rule) return null

    return {
      docType: rule.docType,
      prefix: rule.prefix,
      datePattern: rule.datePattern,
      padding: rule.padding,
      separator: rule.separator,
      resetPolicy: rule.resetPolicy,
    }
  }

  /**
   * 并发安全的取号：先 upsert 占位，再用带条件的原子自增拿到唯一序号。
   * Postgres 的 UPDATE ... RETURNING 保证同一周期内不会发出重复号。
   */
  async nextSequence(docType: string, periodKey: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await tx.docNumberSequence.upsert({
        where: { docType_periodKey: { docType, periodKey } },
        create: { docType, periodKey, lastValue: 0 },
        update: {},
      })

      const updated = await tx.docNumberSequence.update({
        where: { docType_periodKey: { docType, periodKey } },
        data: { lastValue: { increment: 1 } },
        select: { lastValue: true },
      })

      return updated.lastValue
    })
  }
}
