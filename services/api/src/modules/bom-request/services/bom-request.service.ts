import { BOM_ERRORS, PERMISSION_CODES } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { bomRequestStateMachine, isBomRequestEditable } from '../constants/bom-request-states'
import {
  BOM_REQUEST_REPOSITORY,
  type BomRequestDraft,
  type BomRequestQuery,
  type BomRequestRecord,
  type BomRequestRepositoryPort,
} from '../repositories/bom-request.repository.port'

import { assertEligibleForBom, type QuotationLineFacts } from './bom-eligibility.rules'

export interface BomActor {
  userCode: string
  permissions: readonly string[]
}

/**
 * BOM 申请：业务侧（业务规格第 5 章）。
 *
 * > 客户确定下单后，业务提起 BOM 申请，**直接引用报价单内的产品**
 * >（名称图号、版本、材质自动带入；图纸由报价环节上传的版本自动传给工程，不重复上传）。
 * > 样品订单不走 BOM 申请（样品无 BOM）。
 *
 * 「不重复上传」在这里落成一条硬校验：申请必须带 `quotationItemId` 与
 * `drawingVersionId`，两者缺一就退回——没有它们就意味着有人打算另传一份图纸，
 * 而那正是图纸版本失控的起点。
 */
@Injectable()
export class BomRequestService {
  constructor(
    private readonly docNumber: DocNumberService,
    private readonly audit: AuditService,
    private readonly timeline: DocTimelineService,
    @Inject(BOM_REQUEST_REPOSITORY) private readonly repository: BomRequestRepositoryPort,
  ) {}

  static assertSales(actor: BomActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.SALES_OPERATE)) {
      throw new BizError(BOM_ERRORS.SALES_ROLE_REQUIRED)
    }
  }

  /**
   * 建单资格：报价必须生效、样品不建 BOM、图纸沿用报价环节的版本。
   * 报价事实由调用方查好传入——判断规则属于本模块，取数属于 quotation 模块。
   */
  static assertEligible(draft: BomRequestDraft, quotation: QuotationLineFacts): void {
    assertEligibleForBom({
      quotationStatus: quotation.quotationStatus,
      isSampleLine: quotation.isSampleLine,
      quotationItemId: draft.quotationItemId,
      drawingVersionId: draft.drawingVersionId,
    })
  }

  async create(
    draft: BomRequestDraft,
    quotation: QuotationLineFacts,
    actor: BomActor,
  ): Promise<BomRequestRecord> {
    BomRequestService.assertSales(actor)
    BomRequestService.assertEligible(draft, quotation)

    const docNo = await this.docNumber.next(DOC_TYPES.BOM_REQUEST)
    const record = await this.repository.create({ ...draft, docNo, createdBy: actor.userCode })

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'bom-request.create',
      entityType: 'BomRequest',
      entityId: record.docNo,
      after: { productName: record.productName, productionType: record.productionType },
    })

    return record
  }

  async updateDraft(
    id: string,
    versionLock: number,
    draft: BomRequestDraft,
    quotation: QuotationLineFacts,
    actor: BomActor,
  ): Promise<BomRequestRecord> {
    BomRequestService.assertSales(actor)
    BomRequestService.assertEligible(draft, quotation)

    const current = await this.load(id)
    if (!isBomRequestEditable(current.status)) throw new BizError(BOM_ERRORS.NOT_EDITABLE)

    const updated = await this.repository.updateDraft(id, versionLock, draft, actor.userCode)
    if (!updated) throw new BizError(BOM_ERRORS.NOT_EDITABLE)
    return updated
  }

  /** 提交给工程部。被退回后补料重提也走这里。 */
  async submit(id: string, versionLock: number, actor: BomActor): Promise<BomRequestRecord> {
    BomRequestService.assertSales(actor)
    const current = await this.load(id)
    bomRequestStateMachine.assert(current.status, 'SUBMITTED')

    const now = new Date()
    // 退回后重提：把这一轮的等待时长累加进去，时效分析才看得出返工代价
    const returnedMs =
      current.status === 'RETURNED' && current.returnedAt
        ? current.returnedMs + BigInt(Math.max(0, now.getTime() - current.returnedAt.getTime()))
        : current.returnedMs

    const updated = await this.patch(id, versionLock, {
      status: 'SUBMITTED',
      submittedAt: current.submittedAt ?? now,
      returnedMs,
      returnedAt: null,
      updatedBy: actor.userCode,
    })

    await this.timeline.enter({
      docType: DOC_TYPES.BOM_REQUEST,
      docId: id,
      node: '工程接收',
      ownerDept: '工程部',
      at: now,
    })

    return updated
  }

  async load(id: string): Promise<BomRequestRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new BizError(BOM_ERRORS.NOT_FOUND)
    return record
  }

  list(query: BomRequestQuery): Promise<BomRequestRecord[]> {
    return this.repository.list(query)
  }

  private async patch(
    id: string,
    versionLock: number,
    patch: Parameters<BomRequestRepositoryPort['patch']>[2],
  ): Promise<BomRequestRecord> {
    const updated = await this.repository.patch(id, versionLock, patch)
    if (!updated) throw new BizError(BOM_ERRORS.NOT_EDITABLE)
    return updated
  }
}
