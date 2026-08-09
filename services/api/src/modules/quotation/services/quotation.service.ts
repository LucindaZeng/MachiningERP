import { PERMISSION_CODES, QUOTATION_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { isQuotationEditable } from '../constants/quotation-states'
import {
  QUOTATION_REPOSITORY,
  type QuotationHeaderDraft,
  type QuotationItemDraft,
  type QuotationRecord,
  type QuotationRepositoryPort,
} from '../repositories/quotation.repository.port'

import { CostingService } from './costing.service'
import { validateQuotationDraft } from './quotation-rules'
import { resolveUnitCosts } from './unit-cost'

import type { CostAnalysisRecord } from '../repositories/cost-analysis.repository.port'

export interface QuotationActor {
  userCode: string
  permissions: readonly string[]
}

export interface QuotationDraftPayload extends QuotationHeaderDraft {
  customerId: string
  costAnalysisId: string
  /** 单件成本由后端从成本分析推导，因此明细里不带 unitCostMinor */
  items: Array<Omit<QuotationItemDraft, 'tiers'> & { tiers: TierPayload[] }>
}

export interface TierPayload {
  minQuantity: string
  unitPriceMinor: bigint
  label: string | null
}

/**
 * 报价单建单与草稿维护。
 *
 * 业务规格 2.2 的两条硬校验在这里落地，且**建单与提交各校验一次**：
 * 建单时挡住明显不合规的单据，提交时再挡一次，防止建单后成本分析被改。
 */
@Injectable()
export class QuotationService {
  constructor(
    private readonly docNumber: DocNumberService,
    private readonly audit: AuditService,
    private readonly timeline: DocTimelineService,
    private readonly costing: CostingService,
    @Inject(QUOTATION_REPOSITORY) private readonly repository: QuotationRepositoryPort,
  ) {}

  static assertSales(actor: QuotationActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.SALES_OPERATE)) {
      throw new BizError(QUOTATION_ERRORS.QUOTATION_VALIDATION_FAILED, {
        message: '只有业务岗位可以建立或修改报价单',
      })
    }
  }

  async create(payload: QuotationDraftPayload, actor: QuotationActor): Promise<QuotationRecord> {
    QuotationService.assertSales(actor)
    const analysis = await this.loadCompletedAnalysis(payload.costAnalysisId)
    const items = this.buildItems(payload, analysis)

    const docNo = await this.docNumber.next(DOC_TYPES.QUOTATION)
    const record = await this.repository.create({
      ...toHeader(payload),
      docNo,
      version: 1,
      rootId: null,
      customerId: payload.customerId,
      costAnalysisId: payload.costAnalysisId,
      createdBy: actor.userCode,
      items,
    })

    await this.timeline.enter({
      docType: DOC_TYPES.QUOTATION,
      docId: record.id,
      node: '报价单编制',
      ownerUserCode: actor.userCode,
      ownerDept: '业务部',
    })
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'quotation.create',
      entityType: 'Quotation',
      entityId: record.docNo,
      after: { customerId: record.customerId, itemCount: record.items.length },
    })

    return record
  }

  async updateDraft(
    id: string,
    versionLock: number,
    payload: QuotationDraftPayload,
    actor: QuotationActor,
  ): Promise<QuotationRecord> {
    QuotationService.assertSales(actor)
    const current = await this.load(id)
    if (!isQuotationEditable(current.status)) {
      throw new BizError(QUOTATION_ERRORS.QUOTATION_NOT_EDITABLE)
    }

    const analysis = await this.loadCompletedAnalysis(payload.costAnalysisId)
    const items = this.buildItems(payload, analysis)

    const updated = await this.repository.replaceItems(
      id,
      versionLock,
      toHeader(payload),
      items,
      actor.userCode,
    )
    if (!updated) {
      throw new BizError(QUOTATION_ERRORS.QUOTATION_NOT_EDITABLE, {
        message: '报价单已被他人修改，请刷新后重试',
      })
    }

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'quotation.update',
      entityType: 'Quotation',
      entityId: current.docNo,
      before: { itemCount: current.items.length },
      after: { itemCount: updated.items.length },
    })

    return updated
  }

  async load(id: string): Promise<QuotationRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new BizError(QUOTATION_ERRORS.QUOTATION_NOT_FOUND)
    return record
  }

  listByCustomer(customerId: string, limit = 50): Promise<QuotationRecord[]> {
    return this.repository.listByCustomer(customerId, limit)
  }

  /** 成本分析必须已核价完成，否则报价单是在一份还在改的成本上开出来的。 */
  private async loadCompletedAnalysis(costAnalysisId: string): Promise<CostAnalysisRecord> {
    const analysis = await this.costing.load(costAnalysisId)
    if (analysis.status === 'DRAFT') {
      throw new BizError(QUOTATION_ERRORS.QUOTATION_VALIDATION_FAILED, {
        message: `成本分析 ${analysis.docNo} 尚未核价完成，不能据此建立报价单`,
        details: [{ field: 'costAnalysisId', message: '成本分析未完成' }],
      })
    }
    return analysis
  }

  /** 组装明细：把后端推导的单件成本贴到每一档上，再跑结构校验。 */
  private buildItems(
    payload: QuotationDraftPayload,
    analysis: CostAnalysisRecord,
  ): QuotationItemDraft[] {
    const unitCosts = resolveUnitCosts(analysis)

    const items: QuotationItemDraft[] = payload.items.map((item) => ({
      ...item,
      tiers: item.tiers.map((tier) => ({
        ...tier,
        unitCostMinor: unitCosts.get(item.costAnalysisLineId ?? '') ?? 0n,
      })),
    }))

    const issues = validateQuotationDraft({
      customerId: payload.customerId,
      costAnalysisId: payload.costAnalysisId,
      items,
    })
    if (issues.length > 0) {
      throw new BizError(QUOTATION_ERRORS.QUOTATION_VALIDATION_FAILED, {
        message: issues.map((issue) => issue.message).join('；'),
        details: issues,
      })
    }

    return items
  }
}

function toHeader(payload: QuotationDraftPayload): QuotationHeaderDraft {
  return {
    template: payload.template,
    currency: payload.currency,
    fxRateMicros: payload.fxRateMicros,
    fxQuotedOn: payload.fxQuotedOn,
    moldFeeMinor: payload.moldFeeMinor,
    terms: payload.terms,
  }
}
