import { CUSTOMS_ERRORS, PERMISSION_CODES } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { missingFieldsForDossier, type CompletenessFacts } from '../constants/customs-completeness'
import { CUSTOMS_TIMELINE_NODES } from '../constants/customs-timeline'
import {
  CUSTOMS_REPOSITORY,
  type CreateCustomsDossierData,
  type CustomsDossierRecord,
  type CustomsQuery,
  type CustomsRepositoryPort,
} from '../repositories/customs.repository.port'

import type { CustomsDocKind } from '@prisma/client'

export interface CustomsActor {
  userCode: string
  permissions: readonly string[]
}

/**
 * 报关资料建档与读取（EXP-01）。
 *
 * 商品与贸易要素**从出货单与订单带出**，不由前端传：前端能传的东西，前端就能传错，
 * 而报关单上的数量对不上出货单，是到口岸才会被发现的那种错。
 */
@Injectable()
export class CustomsService {
  constructor(
    private readonly docNumber: DocNumberService,
    private readonly audit: AuditService,
    private readonly timeline: DocTimelineService,
    @Inject(CUSTOMS_REPOSITORY) private readonly repository: CustomsRepositoryPort,
  ) {}

  static assertSales(actor: CustomsActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.SALES_OPERATE)) {
      throw new BizError(CUSTOMS_ERRORS.SALES_ROLE_REQUIRED)
    }
  }

  /**
   * 关务复核与申报是独立岗位（业务规格第 10 章「关务复核不可跳过」）。
   * 让建档的人自己复核，这道闸门就只是一次多余的点击。
   */
  static assertCustomsBroker(actor: CustomsActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.CUSTOMS_DECLARE)) {
      throw new BizError(CUSTOMS_ERRORS.CUSTOMS_ROLE_REQUIRED)
    }
  }

  async create(
    data: Omit<CreateCustomsDossierData, 'docNo' | 'createdBy'>,
    actor: CustomsActor,
  ): Promise<CustomsDossierRecord> {
    CustomsService.assertSales(actor)

    const docNo = await this.docNumber.next(DOC_TYPES.CUSTOMS_DOSSIER)
    const record = await this.repository.create({
      ...data,
      docNo,
      createdBy: actor.userCode,
    })

    await this.timeline.enter({
      docType: DOC_TYPES.CUSTOMS_DOSSIER,
      docId: record.id,
      node: CUSTOMS_TIMELINE_NODES.DRAFT.node,
      ownerUserCode: actor.userCode,
      ownerDept: CUSTOMS_TIMELINE_NODES.DRAFT.ownerDept,
    })
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'customs.create',
      entityType: 'CustomsDossier',
      entityId: record.docNo,
      after: { shipmentId: record.shipmentId, hsCode: record.hsCode },
    })

    return record
  }

  async load(id: string): Promise<CustomsDossierRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new BizError(CUSTOMS_ERRORS.NOT_FOUND)
    return record
  }

  list(query: CustomsQuery): Promise<CustomsDossierRecord[]> {
    return this.repository.list(query)
  }
}

/** 记录 → 齐套校验事实。校验规则因此不认识 Prisma，也就能单独测。 */
export function completenessFactsOf(record: CustomsDossierRecord): CompletenessFacts {
  return {
    hsCode: record.hsCode,
    goodsNameCn: record.goodsNameCn,
    goodsNameEn: record.goodsNameEn,
    quantity: record.quantity,
    unit: record.unit,
    netWeight: record.netWeight,
    grossWeight: record.grossWeight,
    packages: record.packages,
    incoterm: record.incoterm,
    portOfLoading: record.portOfLoading,
    destination: record.destination,
    destinationPortCode: record.destinationPortCode,
    shippingMarks: record.shippingMarks,
    exchangeRate: record.exchangeRate,
    totalAmountMinor: record.totalAmountMinor,
  }
}

/**
 * 生成前的齐套硬闸门。缺项时**一次列全**——业务员补一轮就该能过，
 * 不该被逼着一个字段一个字段地试（与出货双闸门同一条约定）。
 */
export function assertFieldsComplete(
  record: CustomsDossierRecord,
  kinds: readonly CustomsDocKind[],
): void {
  const missing = missingFieldsForDossier(kinds, completenessFactsOf(record))
  if (missing.length === 0) return

  throw new BizError(CUSTOMS_ERRORS.FIELDS_INCOMPLETE, {
    message: `报关要素未齐套，缺失：${missing.join('、')}`,
    details: { docNo: record.docNo, missingFields: missing },
  })
}
