import { PERMISSION_CODES, QUOTATION_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DOC_TYPES } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { quotationStateMachine } from '../constants/quotation-states'
import { DEFAULT_VALID_DAYS } from '../constants/quotation-terms'
import {
  QUOTATION_REPOSITORY,
  type QuotationRecord,
  type QuotationRepositoryPort,
  type QuotationStatusPatch,
} from '../repositories/quotation.repository.port'

import { CostingService } from './costing.service'
import { describeBelowCost, findBelowCostTiers, validateQuotationDraft } from './quotation-rules'
import { QuotationService, type QuotationActor } from './quotation.service'

/**
 * 报价单送审与审核。
 *
 * 提交时**再跑一遍**建单时的硬校验，并加上「低于成本价」拦截：
 * 建单到提交之间成本分析可能被重核过，只信建单那一刻的校验结果是不安全的。
 */
@Injectable()
export class QuotationReviewService {
  constructor(
    private readonly quotations: QuotationService,
    private readonly costing: CostingService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly timeline: DocTimelineService,
    @Inject(QUOTATION_REPOSITORY) private readonly repository: QuotationRepositoryPort,
  ) {}

  /** 送审：业务员提交给业务经理。approverUserCode 决定通知发给谁。 */
  async submit(
    id: string,
    versionLock: number,
    approverUserCode: string,
    actor: QuotationActor,
  ): Promise<QuotationRecord> {
    QuotationService.assertSales(actor)
    const current = await this.quotations.load(id)
    quotationStateMachine.assert(current.status, 'IN_REVIEW')
    this.assertSubmittable(current)

    const now = new Date()
    const updated = await this.transition(id, versionLock, {
      status: 'IN_REVIEW',
      submittedBy: actor.userCode,
      submittedAt: now,
      rejectReason: null,
      updatedBy: actor.userCode,
    })

    await this.timeline.enter({
      docType: DOC_TYPES.QUOTATION,
      docId: id,
      node: '报价审核',
      ownerUserCode: approverUserCode,
      ownerDept: '业务部',
      at: now,
    })
    await this.notifications.notify({
      recipientUserCode: approverUserCode,
      category: 'QUOTATION_REVIEW',
      title: `报价单待审核：${current.docNo}`,
      body: `${actor.userCode} 提交了报价单 ${current.docNo}，请审核。`,
      docType: DOC_TYPES.QUOTATION,
      docId: current.docNo,
    })

    return updated
  }

  /**
   * 审核通过 → 报价生效，同时**锁定成本分析版本**。
   * 锁版之后改价只能走「报价单修改申请」再出新版本，历史报价才追得回来。
   */
  async approve(
    id: string,
    versionLock: number,
    validUntil: Date | null,
    actor: QuotationActor,
  ): Promise<QuotationRecord> {
    assertApprover(actor)
    const current = await this.quotations.load(id)
    quotationStateMachine.assert(current.status, 'EFFECTIVE')

    const now = new Date()
    const updated = await this.transition(id, versionLock, {
      status: 'EFFECTIVE',
      validUntil: validUntil ?? defaultValidUntil(now),
      approvedBy: actor.userCode,
      approvedAt: now,
      rejectReason: null,
      updatedBy: actor.userCode,
    })

    await this.costing.lock(current.costAnalysisId)
    await this.timeline.close(DOC_TYPES.QUOTATION, id, 'DONE', now)
    await this.notifyOwner(current, '报价单已通过审核', `${current.docNo} 已生效，可以据此下单。`)
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'quotation.approve',
      entityType: 'Quotation',
      entityId: current.docNo,
      after: { status: 'EFFECTIVE', validUntil: updated.validUntil },
    })

    return updated
  }

  /** 驳回：退回草稿，理由必填并回到业务员工作台。 */
  async reject(
    id: string,
    versionLock: number,
    reason: string,
    actor: QuotationActor,
  ): Promise<QuotationRecord> {
    assertApprover(actor)
    const trimmed = reason.trim()
    if (!trimmed) {
      throw new BizError(QUOTATION_ERRORS.CHANGE_REJECT_REASON_REQUIRED, {
        message: '驳回报价单必须填写理由',
      })
    }

    const current = await this.quotations.load(id)
    quotationStateMachine.assert(current.status, 'DRAFT')

    const updated = await this.transition(id, versionLock, {
      status: 'DRAFT',
      rejectReason: trimmed,
      approvedBy: null,
      approvedAt: null,
      updatedBy: actor.userCode,
    })

    await this.timeline.enter({
      docType: DOC_TYPES.QUOTATION,
      docId: id,
      node: '报价单编制',
      ownerUserCode: current.submittedBy,
      ownerDept: '业务部',
      previousStatus: 'ABNORMAL',
    })
    await this.notifyOwner(current, `报价单被驳回：${current.docNo}`, `驳回理由：${trimmed}`)

    return updated
  }

  /** 生效后的结果登记：成交 / 丢单 / 过期，三者都是终态。 */
  async settle(
    id: string,
    versionLock: number,
    status: 'WON' | 'LOST' | 'EXPIRED',
    actor: QuotationActor,
  ): Promise<QuotationRecord> {
    QuotationService.assertSales(actor)
    const current = await this.quotations.load(id)
    quotationStateMachine.assert(current.status, status)

    return this.transition(id, versionLock, { status, updatedBy: actor.userCode })
  }

  private assertSubmittable(current: QuotationRecord): void {
    const issues = validateQuotationDraft({
      customerId: current.customerId,
      costAnalysisId: current.costAnalysisId,
      items: current.items,
    })
    if (issues.length > 0) {
      throw new BizError(QUOTATION_ERRORS.QUOTATION_VALIDATION_FAILED, {
        message: issues.map((issue) => issue.message).join('；'),
        details: issues,
      })
    }

    const violations = findBelowCostTiers(current.items)
    if (violations.length > 0) {
      throw new BizError(QUOTATION_ERRORS.BELOW_COST, {
        message: describeBelowCost(violations),
        details: violations.map((violation) => ({
          ...violation,
          unitPriceMinor: violation.unitPriceMinor.toString(),
          unitCostMinor: violation.unitCostMinor.toString(),
          shortfallMinor: violation.shortfallMinor.toString(),
        })),
      })
    }
  }

  private async transition(
    id: string,
    versionLock: number,
    patch: QuotationStatusPatch,
  ): Promise<QuotationRecord> {
    const updated = await this.repository.updateStatus(id, versionLock, patch)
    if (!updated) {
      throw new BizError(QUOTATION_ERRORS.QUOTATION_NOT_EDITABLE, {
        message: '报价单已被他人修改，请刷新后重试',
      })
    }
    return updated
  }

  private notifyOwner(record: QuotationRecord, title: string, body: string): Promise<unknown> {
    const recipient = record.submittedBy ?? record.createdBy
    if (!recipient) return Promise.resolve(null)

    return this.notifications.notify({
      recipientUserCode: recipient,
      category: 'QUOTATION_RESULT',
      title,
      body,
      docType: DOC_TYPES.QUOTATION,
      docId: record.docNo,
    })
  }
}

function assertApprover(actor: QuotationActor): void {
  if (!actor.permissions.includes(PERMISSION_CODES.QUOTE_APPROVE)) {
    throw new BizError(QUOTATION_ERRORS.QUOTATION_VALIDATION_FAILED, {
      message: '报价单审核需要业务经理权限',
    })
  }
}

function defaultValidUntil(from: Date): Date {
  return new Date(from.getTime() + DEFAULT_VALID_DAYS * 24 * 60 * 60 * 1000)
}
