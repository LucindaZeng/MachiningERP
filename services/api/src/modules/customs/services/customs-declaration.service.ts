import { CUSTOMS_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DOC_TYPES } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { DOC_KIND_LABEL } from '../constants/customs-doc-kinds'
import { customsStateMachine, isDeclared } from '../constants/customs-states'
import { customsTimelineNodeFor } from '../constants/customs-timeline'
import {
  CUSTOMS_REPOSITORY,
  type CustomsDossierPatch,
  type CustomsDossierRecord,
  type CustomsRepositoryPort,
} from '../repositories/customs.repository.port'

import {
  buildDeclarationManifest,
  diffAgainstDeclaration,
  missingPackDocuments,
  type CorrectionLine,
} from './customs-version.rules'
import { CustomsService, assertFieldsComplete, type CustomsActor } from './customs.service'

import type { CustomsStatus } from '@prisma/client'

/**
 * 关务复核、申报、更正与回执归档（EXP-02、EXP-04）。
 *
 * 本服务守着整个模块最要紧的那条线：**申报是不可变边界**。
 *
 * 申报之前，重新生成文件是日常迭代——有审计日志就够了，强制填理由只会
 * 逼出一堆「修改」二字的样板文字，把真正需要解释的那几次淹掉。
 * 申报之后，任何重出都必须挂在一条**带理由的更正记录**上，因为已申报的资料
 * 是对海关的正式陈述，改它得说得清为什么。
 */
@Injectable()
export class CustomsDeclarationService {
  constructor(
    private readonly audit: AuditService,
    private readonly timeline: DocTimelineService,
    private readonly notifications: NotificationService,
    private readonly customs: CustomsService,
    @Inject(CUSTOMS_REPOSITORY) private readonly repository: CustomsRepositoryPort,
  ) {}

  /** EXP-02：业务把要素送关务复核。 */
  async submitForReview(
    id: string,
    versionLock: number,
    actor: CustomsActor,
  ): Promise<CustomsDossierRecord> {
    CustomsService.assertSales(actor)
    const current = await this.customs.load(id)

    return this.advance(current, versionLock, 'CHECKING', actor, {})
  }

  /** EXP-02：关务复核通过，资料包可以出了。复核人落库，用于「谁放的行」。 */
  async approveReview(
    id: string,
    versionLock: number,
    actor: CustomsActor,
  ): Promise<CustomsDossierRecord> {
    CustomsService.assertCustomsBroker(actor)
    const current = await this.customs.load(id)
    assertFieldsComplete(current, ['DATA_PACK'])

    return this.advance(current, versionLock, 'GENERATED', actor, {
      checkedBy: actor.userCode,
      checkedAt: new Date(),
    })
  }

  /** EXP-02：复核发现要素填错，退回业务改。申报之后就没有这条回头路了。 */
  async returnForFix(
    id: string,
    versionLock: number,
    actor: CustomsActor,
  ): Promise<CustomsDossierRecord> {
    CustomsService.assertCustomsBroker(actor)
    const current = await this.customs.load(id)

    return this.advance(current, versionLock, 'CHECKING', actor, {
      checkedBy: null,
      checkedAt: null,
    })
  }

  /**
   * EXP-04 申报：冻结清单快照。
   *
   * 快照记的是「这一版申报到底送出去了哪几份文件的哪几版」。
   * 之后任何一份再出新版都不许动这张快照——它是复现当时陈述的唯一依据。
   */
  async declare(
    id: string,
    versionLock: number,
    actor: CustomsActor,
  ): Promise<CustomsDossierRecord> {
    CustomsService.assertCustomsBroker(actor)
    const current = await this.customs.load(id)
    assertReviewed(current)
    assertPackReadyForDeclaration(current)

    const version = current.declarationVersion + 1
    const declaredAt = new Date()
    const manifest = buildDeclarationManifest(current.documents)

    const updated = await this.repository.appendDeclaration(
      current.id,
      versionLock,
      { version, declaredBy: actor.userCode, declaredAt, lines: manifest },
      {
        status: 'DECLARED',
        declarationVersion: version,
        declaredAt,
        updatedBy: actor.userCode,
      },
    )
    if (!updated) throw new BizError(CUSTOMS_ERRORS.NOT_EDITABLE)

    await this.enterNode(updated, 'DECLARED', actor)
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'customs.declare',
      entityType: 'CustomsDossier',
      entityId: updated.docNo,
      after: {
        declarationVersion: version,
        manifest: manifest.map((line) => `${DOC_KIND_LABEL[line.kind]} V${line.version}`),
      },
    })

    return updated
  }

  /**
   * 申报之后的更正：把「相对上一版快照重出了哪几份」算出来并连同理由存档。
   *
   * 差异**算出来**而不是让人手填：手填的清单迟早跟实际对不上，
   * 而对不上的更正记录比没有更正记录更糟——它会让复盘的人相信一件假事。
   */
  async correct(
    id: string,
    versionLock: number,
    reason: string,
    actor: CustomsActor,
  ): Promise<CustomsDossierRecord> {
    CustomsService.assertCustomsBroker(actor)
    const trimmed = reason.trim()
    if (!trimmed) throw new BizError(CUSTOMS_ERRORS.CORRECTION_REASON_REQUIRED)

    const current = await this.customs.load(id)
    const lines = collectCorrectionLines(current)

    const version = current.declarationVersion + 1
    const declaredAt = new Date()
    const updated = await this.repository.appendCorrection(
      current.id,
      versionLock,
      {
        sequence: current.corrections.length + 1,
        reason: trimmed,
        resultingDeclarationVersion: version,
        createdBy: actor.userCode,
        lines,
      },
      actor.userCode,
    )
    if (!updated) throw new BizError(CUSTOMS_ERRORS.NOT_EDITABLE)

    const redeclared = await this.redeclare(updated, version, declaredAt, actor)

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'customs.correct',
      entityType: 'CustomsDossier',
      entityId: redeclared.docNo,
      after: {
        reason: trimmed,
        declarationVersion: version,
        changed: lines.map(
          (line) => `${DOC_KIND_LABEL[line.kind]} V${line.fromVersion}→V${line.toVersion}`,
        ),
      },
    })
    await this.notifications.notify({
      recipientUserCode: redeclared.ownerUserCode,
      category: 'CUSTOMS',
      title: `报关资料已更正重报：${redeclared.docNo}`,
      body: `更正理由：${trimmed}`,
      docType: DOC_TYPES.CUSTOMS_DOSSIER,
      docId: redeclared.docNo,
    })

    return redeclared
  }

  /** 更正后重新申报：产生新的一版快照，旧的那版原样留着。 */
  private async redeclare(
    record: CustomsDossierRecord,
    version: number,
    declaredAt: Date,
    actor: CustomsActor,
  ): Promise<CustomsDossierRecord> {
    const redeclared = await this.repository.appendDeclaration(
      record.id,
      record.versionLock,
      {
        version,
        declaredBy: actor.userCode,
        declaredAt,
        lines: buildDeclarationManifest(record.documents),
      },
      { declarationVersion: version, declaredAt, updatedBy: actor.userCode },
    )
    if (!redeclared) throw new BizError(CUSTOMS_ERRORS.NOT_EDITABLE)
    return redeclared
  }

  /** EXP-04 回执归档。挂在指定的申报版本上——每一版申报各有各的回执。 */
  async archiveReceipt(
    id: string,
    versionLock: number,
    receiptNo: string,
    actor: CustomsActor,
  ): Promise<CustomsDossierRecord> {
    CustomsService.assertCustomsBroker(actor)
    const current = await this.customs.load(id)
    assertDeclaredAlready(current)

    const target = current.declarations.find(
      (item) => item.version === current.declarationVersion,
    )
    if (target?.receiptNo) {
      throw new BizError(CUSTOMS_ERRORS.RECEIPT_ALREADY_ARCHIVED, {
        details: { docNo: current.docNo, declarationVersion: target.version },
      })
    }

    const updated = await this.repository.archiveReceipt(
      current.id,
      versionLock,
      current.declarationVersion,
      receiptNo.trim(),
      new Date(),
      actor.userCode,
    )
    if (!updated) throw new BizError(CUSTOMS_ERRORS.NOT_EDITABLE)

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'customs.archive-receipt',
      entityType: 'CustomsDossier',
      entityId: updated.docNo,
      after: { receiptNo, declarationVersion: updated.declarationVersion },
    })

    return updated
  }

  /** 海关放行，单据到终点。 */
  async release(
    id: string,
    versionLock: number,
    actor: CustomsActor,
  ): Promise<CustomsDossierRecord> {
    CustomsService.assertCustomsBroker(actor)
    const current = await this.customs.load(id)

    return this.advance(current, versionLock, 'RELEASED', actor, { releasedAt: new Date() })
  }

  private async advance(
    current: CustomsDossierRecord,
    versionLock: number,
    target: CustomsStatus,
    actor: CustomsActor,
    extra: Omit<CustomsDossierPatch, 'status' | 'updatedBy'>,
  ): Promise<CustomsDossierRecord> {
    customsStateMachine.assert(current.status, target)

    const updated = await this.repository.patch(current.id, versionLock, {
      ...extra,
      status: target,
      updatedBy: actor.userCode,
    })
    if (!updated) throw new BizError(CUSTOMS_ERRORS.NOT_EDITABLE)

    await this.enterNode(updated, target, actor)
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: `customs.${target.toLowerCase()}`,
      entityType: 'CustomsDossier',
      entityId: updated.docNo,
      before: { status: current.status },
      after: { status: updated.status },
    })

    return updated
  }

  private async enterNode(
    record: CustomsDossierRecord,
    status: CustomsStatus,
    actor: CustomsActor,
  ): Promise<void> {
    const node = customsTimelineNodeFor(status)
    if (!node) return

    await this.timeline.enter({
      docType: DOC_TYPES.CUSTOMS_DOSSIER,
      docId: record.id,
      node: node.node,
      ownerUserCode: actor.userCode,
      ownerDept: node.ownerDept,
    })
  }
}

/** 关务复核不可跳过（业务规格第 10 章）。没人复核过就没人为这包资料背书。 */
export function assertReviewed(record: CustomsDossierRecord): void {
  if (record.checkedBy) return

  throw new BizError(CUSTOMS_ERRORS.REVIEW_REQUIRED, {
    details: { docNo: record.docNo, status: record.status },
  })
}

/** 申报前数据包必须齐；缺一份就等于申报了一份不完整的陈述。 */
export function assertPackReadyForDeclaration(record: CustomsDossierRecord): void {
  const missing = missingPackDocuments(record.documents)
  if (missing.length === 0) return

  throw new BizError(CUSTOMS_ERRORS.DATA_PACK_INCOMPLETE, {
    message: `申报前必须先出具：${missing.map((kind) => DOC_KIND_LABEL[kind]).join('、')}`,
    details: { docNo: record.docNo, missing },
  })
}

export function assertDeclaredAlready(record: CustomsDossierRecord): void {
  if (isDeclared(record.status) && record.declarationVersion > 0) return

  throw new BizError(CUSTOMS_ERRORS.CORRECTION_REQUIRES_DECLARATION, {
    details: { docNo: record.docNo, status: record.status },
  })
}

/**
 * 更正记录的内容：与**上一版申报快照**相比重出了哪几份。
 * 一份都没重出就不该建更正记录——空更正只是一条噪音。
 */
export function collectCorrectionLines(record: CustomsDossierRecord): CorrectionLine[] {
  assertDeclaredAlready(record)

  const last = record.declarations.find((item) => item.version === record.declarationVersion)
  const lines = diffAgainstDeclaration(last?.lines ?? [], record.documents)
  if (lines.length === 0) {
    throw new BizError(CUSTOMS_ERRORS.CORRECTION_LINES_REQUIRED, {
      details: { docNo: record.docNo, declarationVersion: record.declarationVersion },
    })
  }

  return lines
}
