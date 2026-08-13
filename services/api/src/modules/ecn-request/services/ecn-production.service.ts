import { ECN_ERRORS, PERMISSION_CODES } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOMAIN_EVENTS, DomainEventPublisher } from '../../../platform/events'
import { AFFECTED_QTY_RULE } from '../constants/ecn-production-impact'
import { ECN_DOC_TYPE } from '../constants/ecn-timeline'
import {
  ECN_REPOSITORY,
  type EcnAffectedLineDraft,
  type EcnRepositoryPort,
  type EcnRequestRecord,
} from '../repositories/ecn.repository.port'

import { EcnContextService } from './ecn-context.service'
import {
  assertQuantityEntryEditable,
  assertReworkInitiable,
} from './ecn-production.rules'
import { EcnRequestService, type EcnActor } from './ecn-request.service'

/** 一条受影响数量的入参。 */
export interface AffectedLineInput {
  productName: string
  drawingNo: string
  /** 已投产（车床/CNC 已动）数量；decimal 字符串 */
  affectedQty: string
  note?: string | null
}

/**
 * 已投产数量的清点录入与返工发起（业务规格第 6 章，新增规则）。
 *
 * 计数定义只有一条，写在 `AFFECTED_QTY_RULE` 上：
 * **只要生产（车床/CNC）动了，就计入受影响数量**；还没上机的料不计。
 * MES 尚未上线，因此是 PMC 人工清点后录入，谁录的、何时录的都留痕。
 *
 * ⚠️ 权限用的是 `ORDER_TRACKING_VIEW`——PMC 现有的 ECN 可见性就挂在它上面
 * （按本轮指令复用既有角色，不新造权限点）。它本质是个**查看**权限却在这里
 * 把住了写入口，且业务部与总经办同样持有它。上线前应换成 PMC 专属的操作权限，
 * 这一条已写进业务部完成报告的 TODO。
 */
@Injectable()
export class EcnProductionService {
  constructor(
    private readonly requests: EcnRequestService,
    private readonly context: EcnContextService,
    private readonly events: DomainEventPublisher,
    private readonly audit: AuditService,
    @Inject(ECN_REPOSITORY) private readonly repository: EcnRepositoryPort,
  ) {}

  static assertPmc(actor: EcnActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.ORDER_TRACKING_VIEW)) {
      throw new BizError(ECN_ERRORS.PMC_ROLE_REQUIRED)
    }
  }

  /**
   * PMC 清点后整表录入。可反复修改——清点常常要跑两趟车间，
   * 真正的锁在下一步：返工一经发起即锁死。
   */
  async enterQuantities(
    id: string,
    versionLock: number,
    lines: readonly AffectedLineInput[],
    actor: EcnActor,
  ): Promise<EcnRequestRecord> {
    EcnProductionService.assertPmc(actor)
    const current = await this.requests.load(id)
    assertQuantityEntryEditable(current.reworkInitiatedAt)

    const drafts: EcnAffectedLineDraft[] = lines.map((line) => ({
      productName: line.productName,
      drawingNo: line.drawingNo,
      affectedQty: line.affectedQty,
      note: line.note ?? null,
      enteredBy: actor.userCode,
    }))

    const saved = await this.repository.replaceAffectedLines(
      id,
      versionLock,
      drafts,
      actor.userCode,
    )
    if (!saved) throw new BizError(ECN_ERRORS.NOT_EDITABLE)

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'ecn.affected-qty.enter',
      entityType: ECN_DOC_TYPE,
      entityId: saved.docNo,
      before: { lineCount: current.affectedLines.length },
      after: {
        lineCount: drafts.length,
        lines: drafts.map((line) => `${line.productName}×${line.affectedQty}`),
        rule: AFFECTED_QTY_RULE,
      },
    })

    return saved
  }

  /**
   * 发起返工。发出领域事件后**数量即锁死**。
   *
   * 事件里必须带新旧图纸版本：只给一个数量，车间无从判断该返成什么样。
   * 与 sales-return 的返工接缝同一类做法——本模块不实现返工，
   * 只把「该返什么、返多少、照哪一版」说清楚交出去。
   */
  async initiateRework(
    id: string,
    versionLock: number,
    actor: EcnActor,
  ): Promise<EcnRequestRecord> {
    EcnProductionService.assertPmc(actor)
    const current = await this.requests.load(id)

    assertReworkInitiable({
      productionImpact: current.productionImpact,
      affectedLineCount: current.affectedLines.length,
      reworkInitiatedAt: current.reworkInitiatedAt,
    })

    const initiatedAt = new Date()
    const updated = await this.repository.patch(id, versionLock, {
      reworkInitiatedAt: initiatedAt,
      reworkInitiatedBy: actor.userCode,
      updatedBy: actor.userCode,
    })
    if (!updated) throw new BizError(ECN_ERRORS.NOT_EDITABLE)

    const linkage = await this.context.linkage(updated)
    await this.events.publish({
      name: DOMAIN_EVENTS.ECN_REWORK_REQUESTED,
      payload: {
        ecnId: updated.id,
        ecnDocNo: updated.docNo,
        productName: updated.productName,
        drawingNo: updated.drawingNo,
        // 返工要照新版做，因此新旧两版都给
        fromRevision: linkage.fromRevision,
        toRevision: linkage.toRevision,
        fromDrawingVersionId: linkage.fromVersionId,
        toDrawingVersionId: linkage.toVersionId,
        effectiveBatch: updated.effectiveBatch,
        lines: updated.affectedLines.map((line) => ({
          productName: line.productName,
          drawingNo: line.drawingNo,
          affectedQty: line.affectedQty,
        })),
      },
    })

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'ecn.rework.initiate',
      entityType: ECN_DOC_TYPE,
      entityId: updated.docNo,
      after: {
        initiatedAt,
        lineCount: updated.affectedLines.length,
        totalQty: totalAffectedQty(updated),
      },
    })

    return updated
  }
}

/**
 * 受影响总数量。用字符串逐位相加太绕，这里落到 Number 只为**审计展示**，
 * 不参与任何业务判断——真正要用的数在每一行上，仍是定点字符串。
 */
export function totalAffectedQty(record: EcnRequestRecord): number {
  return record.affectedLines.reduce((sum, line) => sum + Number(line.affectedQty), 0)
}
