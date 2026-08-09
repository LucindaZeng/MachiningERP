import { PERMISSION_CODES, QUOTATION_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import { quoteChangeStateMachine } from '../constants/quotation-states'
import {
  QUOTE_CHANGE_REQUEST_REPOSITORY,
  type QuoteChangeRequestRecord,
  type QuoteChangeRequestRepositoryPort,
  type QuoteTargetPrice,
} from '../repositories/quote-change-request.repository.port'

import { CostingService } from './costing.service'
import { QuotationService, type QuotationActor } from './quotation.service'

import type {
  CostAnalysisLineDraft,
  CostRateData,
} from '../repositories/cost-analysis.repository.port'

export interface SubmitQuoteChangeInput {
  quotationId: string
  targetPrices: QuoteTargetPrice[]
  reason: string
  /** 收到申请的报价工程师 */
  engineerUserCode: string
}

/**
 * 报价单修改申请（业务规格 2.4 的闭环）。
 *
 * 「业务员认为价格偏高时提交修改申请 → 报价工程师**要么重新核价出新版本，
 * 要么驳回并说明理由**，理由回到业务员的工作台。」
 *
 * 这里刻意不提供「直接改价」的口子：改价必然伴随一份新的成本分析版本，
 * 否则报价与成本就脱钩了，事后再也说不清当时是按什么成本报的。
 */
@Injectable()
export class QuoteChangeRequestService {
  constructor(
    private readonly docNumber: DocNumberService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly quotations: QuotationService,
    private readonly costing: CostingService,
    @Inject(QUOTE_CHANGE_REQUEST_REPOSITORY)
    private readonly repository: QuoteChangeRequestRepositoryPort,
  ) {}

  async submit(
    input: SubmitQuoteChangeInput,
    actor: QuotationActor,
  ): Promise<QuoteChangeRequestRecord> {
    QuotationService.assertSales(actor)
    const reason = requireText(input.reason, '修改申请必须说明原因')
    if (input.targetPrices.length === 0) {
      throw new BizError(QUOTATION_ERRORS.QUOTATION_VALIDATION_FAILED, {
        message: '修改申请至少要给出一档目标价',
      })
    }

    const quotation = await this.quotations.load(input.quotationId)
    const requestNo = await this.docNumber.next(DOC_TYPES.QUOTE_CHANGE_REQUEST)
    const record = await this.repository.create({
      requestNo,
      quotationId: quotation.id,
      targetPrices: input.targetPrices,
      reason,
      submittedBy: actor.userCode,
    })

    await this.notifications.notify({
      recipientUserCode: input.engineerUserCode,
      category: 'QUOTE_CHANGE_REQUEST',
      title: `报价单修改申请：${quotation.docNo}`,
      body: `${actor.userCode} 申请调整 ${quotation.docNo} 的报价：${reason}`,
      docType: DOC_TYPES.QUOTE_CHANGE_REQUEST,
      docId: record.requestNo,
    })

    return record
  }

  /**
   * 重核：派生一份新的成本分析版本并挂到申请上。
   * `lines` 传 null 表示先复制原明细，报价工程师再在新版本上改。
   */
  async revise(
    id: string,
    versionLock: number,
    lines: CostAnalysisLineDraft[] | null,
    actor: QuotationActor,
    rates: CostRateData | null = null,
  ): Promise<QuoteChangeRequestRecord> {
    assertHandler(actor)
    const current = await this.load(id)
    quoteChangeStateMachine.assert(current.status, 'REVISED')

    const quotation = await this.quotations.load(current.quotationId)
    const revised = await this.costing.reviseFrom(
      quotation.costAnalysisId,
      lines,
      { userCode: actor.userCode, permissions: actor.permissions },
      rates,
    )

    const handled = await this.persist(id, versionLock, {
      status: 'REVISED',
      handledBy: actor.userCode,
      handledAt: new Date(),
      revisedCostAnalysisId: revised.id,
    })

    await this.notify(
      current,
      `修改申请已重核：${quotation.docNo}`,
      `报价工程师已出具新成本分析 ${revised.docNo}（第 ${revised.version} 版），请据此调整报价。`,
    )
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'quote-change.revise',
      entityType: 'QuoteChangeRequest',
      entityId: current.requestNo,
      after: { revisedCostAnalysis: revised.docNo },
    })

    return handled
  }

  /** 驳回：理由必填，且必须回到提交人的工作台。 */
  async reject(
    id: string,
    versionLock: number,
    reason: string,
    actor: QuotationActor,
  ): Promise<QuoteChangeRequestRecord> {
    assertHandler(actor)
    const trimmed = reason.trim()
    if (!trimmed) {
      throw new BizError(QUOTATION_ERRORS.CHANGE_REJECT_REASON_REQUIRED)
    }

    const current = await this.load(id)
    quoteChangeStateMachine.assert(current.status, 'REJECTED')

    const handled = await this.persist(id, versionLock, {
      status: 'REJECTED',
      handledBy: actor.userCode,
      handledAt: new Date(),
      rejectReason: trimmed,
    })

    await this.notify(current, '报价单修改申请被驳回', `驳回理由：${trimmed}`)
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'quote-change.reject',
      entityType: 'QuoteChangeRequest',
      entityId: current.requestNo,
      after: { rejectReason: trimmed },
    })

    return handled
  }

  async load(id: string): Promise<QuoteChangeRequestRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new BizError(QUOTATION_ERRORS.CHANGE_REQUEST_NOT_FOUND)
    return record
  }

  listByQuotation(quotationId: string): Promise<QuoteChangeRequestRecord[]> {
    return this.repository.listByQuotation(quotationId)
  }

  private async persist(
    id: string,
    versionLock: number,
    data: Parameters<QuoteChangeRequestRepositoryPort['handle']>[2],
  ): Promise<QuoteChangeRequestRecord> {
    const handled = await this.repository.handle(id, versionLock, data)
    if (!handled) throw new BizError(QUOTATION_ERRORS.CHANGE_REQUEST_ALREADY_HANDLED)
    return handled
  }

  private notify(
    record: QuoteChangeRequestRecord,
    title: string,
    body: string,
  ): Promise<unknown> {
    return this.notifications.notify({
      recipientUserCode: record.submittedBy,
      category: 'QUOTE_CHANGE_RESULT',
      title,
      body,
      docType: DOC_TYPES.QUOTE_CHANGE_REQUEST,
      docId: record.requestNo,
    })
  }
}

function assertHandler(actor: QuotationActor): void {
  if (!actor.permissions.includes(PERMISSION_CODES.QUOTE_CHANGE_HANDLE)) {
    throw new BizError(QUOTATION_ERRORS.COSTING_ROLE_REQUIRED, {
      message: '报价单修改申请只能由报价工程师处理',
    })
  }
}

function requireText(value: string, message: string): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    throw new BizError(QUOTATION_ERRORS.QUOTATION_VALIDATION_FAILED, { message })
  }
  return trimmed
}
