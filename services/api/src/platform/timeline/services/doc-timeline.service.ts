import { Inject, Injectable } from '@nestjs/common'

import {
  DOC_TIMELINE_REPOSITORY,
  type DocTimelineRepositoryPort,
  type TimelineNodeRecord,
} from '../repositories/doc-timeline.repository.port'

import type { TimelineNodeStatus } from '@prisma/client'


export interface EnterNodeInput {
  docType: string
  docId: string
  node: string
  ownerUserCode?: string | null
  ownerDept?: string | null
  remark?: string | null
  /** 上一个节点的收尾状态：默认 DONE，异常场景传 ABNORMAL */
  previousStatus?: TimelineNodeStatus
  at?: Date
}

/**
 * 节点计时（api-conventions.md「审计与计时」、需求「每个环节花了多长时间」）。
 * 进入新节点时自动关闭上一个未结束的节点并结算耗时，因此耗时永远不需要业务模块自己算。
 */
@Injectable()
export class DocTimelineService {
  constructor(
    @Inject(DOC_TIMELINE_REPOSITORY)
    private readonly repository: DocTimelineRepositoryPort,
  ) {}

  async enter(input: EnterNodeInput): Promise<TimelineNodeRecord> {
    const at = input.at ?? new Date()
    const open = await this.repository.findOpenNode(input.docType, input.docId)

    if (open) {
      await this.repository.closeNode({
        id: open.id,
        leftAt: at,
        durationMs: BigInt(Math.max(0, at.getTime() - open.enteredAt.getTime())),
        status: input.previousStatus ?? 'DONE',
      })
    }

    return this.repository.openNode({
      docType: input.docType,
      docId: input.docId,
      node: input.node,
      sequence: (open?.sequence ?? 0) + 1,
      ownerUserCode: input.ownerUserCode ?? null,
      ownerDept: input.ownerDept ?? null,
      remark: input.remark ?? null,
    })
  }

  /** 单据终结：关闭最后一个开放节点，不再开新节点。 */
  async close(
    docType: string,
    docId: string,
    status: TimelineNodeStatus = 'DONE',
    at: Date = new Date(),
  ): Promise<void> {
    const open = await this.repository.findOpenNode(docType, docId)
    if (!open) return

    await this.repository.closeNode({
      id: open.id,
      leftAt: at,
      durationMs: BigInt(Math.max(0, at.getTime() - open.enteredAt.getTime())),
      status,
    })
  }

  list(docType: string, docId: string): Promise<TimelineNodeRecord[]> {
    return this.repository.listByDoc(docType, docId)
  }
}
