import { ECN_ERRORS, PERMISSION_CODES } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { assertEcnChangeType } from '../constants/ecn-change-types'
import { ecnStateMachine } from '../constants/ecn-states'
import { ECN_DOC_TYPE, ecnTimelineNodeFor } from '../constants/ecn-timeline'
import {
  ECN_REPOSITORY,
  type EcnQuery,
  type EcnRepositoryPort,
  type EcnRequestRecord,
} from '../repositories/ecn.repository.port'

import { assertNewDrawingProvided, assertNotSampleStage, type EcnOrderFacts } from './ecn-scope.rules'

import type { EcnOrigin } from '@prisma/client'

export interface EcnActor {
  userCode: string
  permissions: readonly string[]
}

export interface CreateEcnInput {
  customerId: string
  orderId: string | null
  productName: string
  drawingNo: string
  drawingVersionId: string | null
  /** 改图时必填；由 quotation 的图纸上传通道产生，本模块不另建上传路径 */
  newDrawingVersionId: string | null
  bomRequestId: string | null
  quotationId: string | null
  /** 前端那套小写枚举；越界值在这里被点名拒绝 */
  changeType: string
  origin: EcnOrigin
  urgent: boolean
  beforeValue: string
  afterValue: string
  reason: string
}

/**
 * ECN 的建单与提交（ECN-01）。
 *
 * 两道闸门都在**提交那一刻**判，而不是等到评估：
 * 受理范围（改数量/交期/价格一律拒收并指路）与样品阶段重定向。
 * 放到评估环节判，意味着工程要先花时间读一份根本不该进来的单子。
 */
@Injectable()
export class EcnRequestService {
  constructor(
    private readonly numbering: DocNumberService,
    private readonly audit: AuditService,
    private readonly timeline: DocTimelineService,
    @Inject(ECN_REPOSITORY) private readonly repository: EcnRepositoryPort,
  ) {}

  static assertSales(actor: EcnActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.SALES_OPERATE)) {
      throw new BizError(ECN_ERRORS.SALES_ROLE_REQUIRED)
    }
  }

  /**
   * 建档并直接进入「已提交」。
   *
   * 不留一个只能自己看的草稿态：ECN 的价值在于让工程尽快看到变更，
   * 而草稿箱里的变更申请等于没提。前端的 `draft` 状态留给本地暂存（DraftToolbar）。
   */
  async create(
    input: CreateEcnInput,
    order: EcnOrderFacts | null,
    actor: EcnActor,
  ): Promise<EcnRequestRecord> {
    EcnRequestService.assertSales(actor)

    const changeType = assertEcnChangeType(input.changeType)
    assertNotSampleStage(order)
    assertNewDrawingProvided(changeType, input.newDrawingVersionId)

    const docNo = await this.numbering.next(DOC_TYPES.ECN_REQUEST)
    const created = await this.repository.create({
      docNo,
      customerId: input.customerId,
      orderId: input.orderId,
      productName: input.productName,
      drawingNo: input.drawingNo,
      drawingVersionId: input.drawingVersionId,
      newDrawingVersionId: input.newDrawingVersionId,
      bomRequestId: input.bomRequestId,
      quotationId: input.quotationId,
      changeType,
      origin: input.origin,
      urgent: input.urgent,
      beforeValue: input.beforeValue,
      afterValue: input.afterValue,
      reason: input.reason,
      ownerUserCode: actor.userCode,
      createdBy: actor.userCode,
    })

    const submitted = await this.advance(created, 'SUBMITTED', actor, {
      submittedAt: new Date(),
    })

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'ecn.submit',
      entityType: ECN_DOC_TYPE,
      entityId: submitted.docNo,
      after: { changeType, origin: input.origin, urgent: input.urgent, orderId: input.orderId },
    })

    return submitted
  }

  /** 工程认领并开始评估（ECN-02）。 */
  async startAssessment(
    id: string,
    versionLock: number,
    actor: EcnActor,
  ): Promise<EcnRequestRecord> {
    const current = await this.load(id)
    return this.advance({ ...current, versionLock }, 'ASSESSING', actor, {
      assessedBy: actor.userCode,
    })
  }

  /** 退回业务补充说明——看不懂的变更不该硬着头皮评。 */
  async returnForDetail(
    id: string,
    versionLock: number,
    actor: EcnActor,
  ): Promise<EcnRequestRecord> {
    const current = await this.load(id)
    return this.advance({ ...current, versionLock }, 'SUBMITTED', actor, {})
  }

  async load(id: string): Promise<EcnRequestRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new BizError(ECN_ERRORS.NOT_FOUND)
    return record
  }

  list(query: EcnQuery): Promise<EcnRequestRecord[]> {
    return this.repository.list(query)
  }

  /**
   * 状态迁移的唯一出口：**先判迁移合法性 → 再落库 → 再记节点**。
   *
   * 顺序不能反。先记节点再落库，落库失败就会留下一个指向不存在状态的时间线节点，
   * 而时间线是事后追责用的，它比业务数据更不能有假。
   */
  async advance(
    record: EcnRequestRecord,
    to: EcnRequestRecord['status'],
    actor: EcnActor,
    patch: Omit<Parameters<EcnRepositoryPort['patch']>[2], 'updatedBy' | 'status'>,
  ): Promise<EcnRequestRecord> {
    ecnStateMachine.assert(record.status, to)

    const updated = await this.repository.patch(record.id, record.versionLock, {
      ...patch,
      status: to,
      updatedBy: actor.userCode,
    })
    if (!updated) throw new BizError(ECN_ERRORS.NOT_EDITABLE)

    const node = ecnTimelineNodeFor(to)
    if (node) {
      await this.timeline.enter({
        docType: ECN_DOC_TYPE,
        docId: updated.id,
        node: node.node,
        ownerUserCode: actor.userCode,
        ownerDept: node.ownerDept,
      })
    }

    return updated
  }
}
