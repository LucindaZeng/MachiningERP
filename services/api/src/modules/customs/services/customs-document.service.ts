import { CUSTOMS_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOC_TYPES } from '../../../platform/numbering'
import {
  DOC_KIND_LABEL,
  DOC_KIND_TO_TEMPLATE,
  REQUIRED_FOR_DATA_PACK,
  requiresPostedShipment,
} from '../constants/customs-doc-kinds'
import {
  CUSTOMS_REPOSITORY,
  type CustomsDossierRecord,
  type CustomsRepositoryPort,
} from '../repositories/customs.repository.port'
import {
  DOCUMENT_RENDER_PORT,
  type DocumentRenderPort,
} from '../repositories/document-render.port'

import { missingPackDocuments, nextVersionOf } from './customs-version.rules'
import { CustomsService, assertFieldsComplete, type CustomsActor } from './customs.service'

import type { CustomsDocKind } from '@prisma/client'

/** 出具文件时要用到的出货事实：是否已实际发出、当日汇率。 */
export interface ShipmentPostingFacts {
  posted: boolean
  /** 出具那一刻的汇率；由调用方从当日汇率表取好传进来 */
  exchangeRate: string
}

/**
 * 报关文件的出具与版本管理（EXP-03）。
 *
 * 本模块最核心的一条不变量：**生成永远是追加，不是覆盖**
 * （业务规格第 10 章「已提交版本只能更正或生成新版本，不能覆盖」）。
 * 每一版都带着自己那一刻的汇率快照冻结下来，因此同一个资料包里
 * 先后出的两份文件汇率可以不同——它们本来就是不同日子出具的单据。
 */
@Injectable()
export class CustomsDocumentService {
  constructor(
    private readonly audit: AuditService,
    private readonly customs: CustomsService,
    @Inject(CUSTOMS_REPOSITORY) private readonly repository: CustomsRepositoryPort,
    @Inject(DOCUMENT_RENDER_PORT) private readonly renderer: DocumentRenderPort,
  ) {}

  /**
   * 出具一份文件的新版本。
   *
   * 顺序是有意的：先判权限 → 再查要素齐套 → 再查发货前置 → 才去渲染。
   * 反过来先渲染，闸门失败时对象存储里已经躺了一份没人认领的文件。
   */
  async generate(
    id: string,
    versionLock: number,
    kind: CustomsDocKind,
    shipment: ShipmentPostingFacts,
    actor: CustomsActor,
  ): Promise<CustomsDossierRecord> {
    CustomsService.assertSales(actor)
    const current = await this.customs.load(id)

    assertFieldsComplete(current, [kind])
    assertShipmentReady(current, kind, shipment.posted)
    if (kind === 'DATA_PACK') assertPackComplete(current)

    const version = nextVersionOf(current.documents, kind)
    const rendered = await this.renderer.render({
      dossierId: current.id,
      docNo: current.docNo,
      kind,
      templateCode: DOC_KIND_TO_TEMPLATE[kind],
      version,
      exchangeRate: shipment.exchangeRate,
      currency: current.currency,
    })

    const updated = await this.repository.appendDocument(
      current.id,
      versionLock,
      {
        kind,
        version,
        objectKey: rendered.objectKey,
        fileName: rendered.fileName,
        // 汇率快照跟着这一版走，之后汇率再变也不动它
        exchangeRate: shipment.exchangeRate,
        currency: current.currency,
        generatedBy: actor.userCode,
      },
      actor.userCode,
    )
    if (!updated) throw new BizError(CUSTOMS_ERRORS.NOT_EDITABLE)

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'customs.generate-document',
      entityType: 'CustomsDossier',
      entityId: updated.docNo,
      after: {
        kind,
        version,
        exchangeRate: shipment.exchangeRate,
        declaredBefore: updated.declarationVersion > 0,
      },
    })

    return updated
  }

  /** 某种文件的最新一版；没生成过就抛 404，而不是返回一个空壳。 */
  latestOf(record: CustomsDossierRecord, kind: CustomsDocKind) {
    const versions = record.documents.filter((doc) => doc.kind === kind)
    const latest = versions.reduce<(typeof versions)[number] | null>(
      (best, doc) => (best === null || doc.version > best.version ? doc : best),
      null,
    )
    if (!latest) {
      throw new BizError(CUSTOMS_ERRORS.DOCUMENT_NOT_FOUND, {
        message: `${DOC_KIND_LABEL[kind]} 尚未生成`,
        details: { docNo: record.docNo, kind, docType: DOC_TYPES.CUSTOMS_DOSSIER },
      })
    }
    return latest
  }
}

/**
 * 商业发票、装箱单、数据包按**实发**数量与重量开具。
 *
 * 没过账就没有实发数，这时生成只能填订单数——而订单数与箱单对不上，
 * 正是货到口岸才被打回的那类事故。形式发票与合同不受此限：
 * 它们本来就活在发货之前（形式发票的用途就是开信用证收预付款）。
 */
export function assertShipmentReady(
  record: CustomsDossierRecord,
  kind: CustomsDocKind,
  posted: boolean,
): void {
  if (!requiresPostedShipment(kind) || posted) return

  throw new BizError(CUSTOMS_ERRORS.SHIPMENT_NOT_POSTED, {
    message: `${DOC_KIND_LABEL[kind]} 按实发数量开具，出货过账后才能生成`,
    details: { docNo: record.docNo, kind, shipmentId: record.shipmentId },
  })
}

/** 数据包引用的是商业发票、装箱单与合同；缺一份就没法申报。 */
export function assertPackComplete(record: CustomsDossierRecord): void {
  const missing = missingPackDocuments(record.documents)
  if (missing.length === 0) return

  throw new BizError(CUSTOMS_ERRORS.DATA_PACK_INCOMPLETE, {
    message: `生成报关数据包前必须先出具：${missing.map((kind) => DOC_KIND_LABEL[kind]).join('、')}`,
    details: { docNo: record.docNo, missing, required: REQUIRED_FOR_DATA_PACK },
  })
}
