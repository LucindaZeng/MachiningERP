import { ORDER_ERRORS, PERMISSION_CODES } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { isOrderEditable } from '../constants/order-states'
import {
  SALES_ORDER_REPOSITORY,
  type CreateSalesOrderData,
  type SalesOrderHeaderDraft,
  type SalesOrderLineDraft,
  type SalesOrderQuery,
  type SalesOrderRecord,
  type SalesOrderRepositoryPort,
} from '../repositories/sales-order.repository.port'

import { collectPrerequisiteIssues, type OrderFacts } from './order-prerequisites'

import type { SalesOrderType } from '@prisma/client'

export interface OrderActor {
  userCode: string
  permissions: readonly string[]
}

export interface SalesOrderDraftPayload extends SalesOrderHeaderDraft {
  lines: SalesOrderLineDraft[]
}

/** 下单前置校验需要的外部事实，由调用方（controller / 其他模块）查好后传入。 */
export interface OrderContext {
  customerReadyForOrder: boolean
  /** 每一行的 BOM 是否已建立完成；键是行序号 */
  bomConfirmed: Record<number, boolean>
}

/** 各订单类型的取号规则 */
const DOC_TYPE_BY_ORDER: Record<SalesOrderType, string> = {
  FORMAL: DOC_TYPES.SALES_ORDER,
  SAMPLE: DOC_TYPES.SAMPLE_ORDER,
  MOLD: DOC_TYPES.MOLD_ORDER,
  STOCK_PREP: DOC_TYPES.STOCK_PREP_ORDER,
}

/**
 * 订单建单与草稿维护（业务规格 4.1~4.5）。
 *
 * 建单与提交**各跑一次**下单强制校验：建单时挡住明显不合规的单子，
 * 提交时再挡一次，防止建单之后报价被改版或 BOM 被退回。
 */
@Injectable()
export class SalesOrderService {
  constructor(
    private readonly docNumber: DocNumberService,
    private readonly audit: AuditService,
    private readonly timeline: DocTimelineService,
    @Inject(SALES_ORDER_REPOSITORY) private readonly repository: SalesOrderRepositoryPort,
  ) {}

  static assertSales(actor: OrderActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.SALES_OPERATE)) {
      throw new BizError(ORDER_ERRORS.SALES_ROLE_REQUIRED)
    }
  }

  async create(
    payload: SalesOrderDraftPayload,
    context: OrderContext,
    actor: OrderActor,
  ): Promise<SalesOrderRecord> {
    SalesOrderService.assertSales(actor)
    SalesOrderService.assertPrerequisites(payload, context)

    const docNo = await this.docNumber.next(DOC_TYPE_BY_ORDER[payload.orderType])
    const record = await this.repository.create(toCreateData(payload, docNo, actor.userCode))

    await this.timeline.enter({
      docType: DOC_TYPES.SALES_ORDER,
      docId: record.id,
      node: '订单编制',
      ownerUserCode: actor.userCode,
      ownerDept: '业务部',
    })
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'sales-order.create',
      entityType: 'SalesOrder',
      entityId: record.docNo,
      after: { orderType: record.orderType, lineCount: record.lines.length },
    })

    return record
  }

  async updateDraft(
    id: string,
    versionLock: number,
    payload: SalesOrderDraftPayload,
    context: OrderContext,
    actor: OrderActor,
  ): Promise<SalesOrderRecord> {
    SalesOrderService.assertSales(actor)
    const current = await this.load(id)
    if (!isOrderEditable(current.status)) throw new BizError(ORDER_ERRORS.ORDER_NOT_EDITABLE)

    SalesOrderService.assertPrerequisites(payload, context)

    const updated = await this.repository.replaceLines(
      id,
      versionLock,
      toHeader(payload),
      payload.lines,
      actor.userCode,
    )
    if (!updated) throw new BizError(ORDER_ERRORS.ORDER_NOT_EDITABLE)

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'sales-order.update',
      entityType: 'SalesOrder',
      entityId: current.docNo,
      before: { lineCount: current.lines.length },
      after: { lineCount: updated.lines.length },
    })

    return updated
  }

  /**
   * 跑下单强制校验并把清单包成错误。
   *
   * 静态方法：提交环节要用同一套口径再跑一次，
   * 而那段逻辑住在 OrderReviewService 里——共享的是规则，不是实例。
   */
  static assertPrerequisites(payload: SalesOrderDraftPayload, context: OrderContext): void {
    const issues = collectPrerequisiteIssues(toFacts(payload, context))
    if (issues.length === 0) return

    throw new BizError(ORDER_ERRORS.PREREQUISITES_MISSING, {
      message: issues.map((issue) => issue.message).join('；'),
      details: issues,
    })
  }

  async load(id: string): Promise<SalesOrderRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new BizError(ORDER_ERRORS.ORDER_NOT_FOUND)
    return record
  }

  list(query: SalesOrderQuery): Promise<SalesOrderRecord[]> {
    return this.repository.list(query)
  }
}

function toHeader(payload: SalesOrderDraftPayload): SalesOrderHeaderDraft {
  const { lines: _lines, ...header } = payload
  return header
}

function toCreateData(
  payload: SalesOrderDraftPayload,
  docNo: string,
  createdBy: string,
): CreateSalesOrderData {
  return { ...toHeader(payload), docNo, createdBy, lines: payload.lines }
}

/** 领域草稿 + 外部事实 → 校验链的入参形状。 */
export function toFacts(payload: SalesOrderDraftPayload, context: OrderContext): OrderFacts {
  return {
    orderType: payload.orderType,
    chargeMode: payload.chargeMode,
    customerPoNo: payload.customerPoNo,
    customerPoFile: payload.customerPoFile,
    internalDueDate: payload.internalDueDate,
    costOwner: payload.costOwner,
    freeReason: payload.freeReason,
    estimatedCostMinor: payload.estimatedCostMinor,
    customerReadyForOrder: context.customerReadyForOrder,
    lines: payload.lines.map((line) => ({
      sequence: line.sequence,
      productName: line.productName,
      quotationItemId: line.quotationItemId,
      costAnalysisId: line.costAnalysisId,
      drawingVersionId: line.drawingVersionId,
      bomConfirmed: context.bomConfirmed[line.sequence] ?? false,
      itemCode: line.itemCode,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      deliveryDate: line.deliveryDate,
    })),
  }
}
