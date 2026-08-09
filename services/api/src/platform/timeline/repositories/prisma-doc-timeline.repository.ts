import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CloseNodeInput,
  DocTimelineRepositoryPort,
  OpenNodeInput,
  TimelineNodeRecord,
} from './doc-timeline.repository.port'


@Injectable()
export class PrismaDocTimelineRepository implements DocTimelineRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  findOpenNode(docType: string, docId: string): Promise<TimelineNodeRecord | null> {
    return this.prisma.docTimeline.findFirst({
      where: { docType, docId, leftAt: null },
      orderBy: { sequence: 'desc' },
    })
  }

  listByDoc(docType: string, docId: string): Promise<TimelineNodeRecord[]> {
    return this.prisma.docTimeline.findMany({
      where: { docType, docId },
      orderBy: { sequence: 'asc' },
    })
  }

  openNode(input: OpenNodeInput): Promise<TimelineNodeRecord> {
    return this.prisma.docTimeline.create({
      data: {
        docType: input.docType,
        docId: input.docId,
        node: input.node,
        sequence: input.sequence,
        status: 'IN_PROGRESS',
        ownerUserCode: input.ownerUserCode ?? null,
        ownerDept: input.ownerDept ?? null,
        remark: input.remark ?? null,
      },
    })
  }

  async closeNode(input: CloseNodeInput): Promise<void> {
    await this.prisma.docTimeline.update({
      where: { id: input.id },
      data: { leftAt: input.leftAt, durationMs: input.durationMs, status: input.status },
    })
  }
}
