import { SALES_RETURN_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOMAIN_EVENTS, DomainEventPublisher } from '../../../platform/events'
import { NotificationService } from '../../../platform/notification'
import { DOC_TYPES } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { requiresGoodsReceipt } from '../constants/return-dispositions'
import { salesReturnStateMachine } from '../constants/return-states'
import { returnTimelineNodeFor } from '../constants/return-timeline'
import {
  RETURN_SETTLEMENT_PORT,
  type ReturnSettlementPort,
} from '../repositories/return-settlement.port'
import {
  SALES_RETURN_REPOSITORY,
  type SalesReturnLinePatch,
  type SalesReturnPatch,
  type SalesReturnRecord,
  type SalesReturnRepositoryPort,
} from '../repositories/sales-return.repository.port'

import {
  collectClosureIssues,
  needsFinanceApproval,
  reworkLines,
  type ReturnLineFacts,
} from './return-disposition.rules'
import { deductionMinorOf, deductionTypeOf } from './return-statement.rules'
import { SalesReturnService, assertAmountsMutable, type ReturnActor } from './sales-return.service'

import type { SalesReturnStatus } from '@prisma/client'

export interface JudgeLineInput {
  lineId: string
  responsibility: SalesReturnLinePatch['responsibility']
}

export interface DispositionLineInput {
  lineId: string
  disposition: NonNullable<SalesReturnLinePatch['disposition']>
  dispositionNote: string | null
  allowanceMinor: bigint | null
}

/**
 * RMA-02~05 的节点推进。
 *
 * 三方各改各的字段，这是本服务里最要紧的一条线：
 * - **品质**判责任归属（RMA-02），业务不能自己填；
 * - **业务**提处置方案（RMA-03），涉及退款 / 补货 / 让步的自动升级到财务；
 * - **仓储**登记退货入库（RMA-04），返工必须等这一步才能开工。
 *
 * 结案（RMA-05）是本模块唯一会产生财务后果的动作：闸门再校一次逐行处置，
 * 通过后**锁死金额**、发结案事件、把动钱的行推给财务 seam。
 */
@Injectable()
export class ReturnFlowService {
  constructor(
    private readonly audit: AuditService,
    private readonly timeline: DocTimelineService,
    private readonly events: DomainEventPublisher,
    private readonly notifications: NotificationService,
    private readonly returns: SalesReturnService,
    @Inject(SALES_RETURN_REPOSITORY) private readonly repository: SalesReturnRepositoryPort,
    @Inject(RETURN_SETTLEMENT_PORT) private readonly settlement: ReturnSettlementPort,
  ) {}

  /**
   * RMA-01 → RMA-02：业务首次响应客户，同时把单子交给品质判定。
   *
   * 首响打点与转品质是**同一个动作**而不是两个：客诉的首响 SLA 算的就是
   * 「多久之内有人接手」，接手了却不转判定，那 SLA 数字是虚的。
   * 重复调用会被状态机挡下（已经离开 REGISTERED）——首响天然只有一次。
   */
  async respond(id: string, versionLock: number, actor: ReturnActor): Promise<SalesReturnRecord> {
    SalesReturnService.assertSales(actor)
    const current = await this.returns.load(id)

    return this.advance(current, versionLock, 'QUALITY_JUDGING', actor, {
      respondedAt: new Date(),
    })
  }

  /** RMA-02：品质逐行判定责任归属。判完整单进入处置审批。 */
  async judge(
    id: string,
    versionLock: number,
    lines: readonly JudgeLineInput[],
    actor: ReturnActor,
  ): Promise<SalesReturnRecord> {
    SalesReturnService.assertQuality(actor)
    const current = await this.returns.load(id)
    assertAmountsMutable(current)

    const patched = await this.applyLinePatches(
      current,
      versionLock,
      lines.map((line) => ({ lineId: line.lineId, patch: { responsibility: line.responsibility } })),
      actor,
    )

    return this.advance(patched, patched.versionLock, 'DISPOSITION', actor, {
      judgedAt: new Date(),
      judgedBy: actor.userCode,
    })
  }

  /** RMA-03：业务逐行提处置方案。是否需要财务审批由处置组合推导，业务勾不了。 */
  async submitDisposition(
    id: string,
    versionLock: number,
    lines: readonly DispositionLineInput[],
    actor: ReturnActor,
  ): Promise<SalesReturnRecord> {
    SalesReturnService.assertSales(actor)
    const current = await this.returns.load(id)
    assertAmountsMutable(current)

    const patched = await this.applyLinePatches(
      current,
      versionLock,
      lines.map((line) => ({
        lineId: line.lineId,
        patch: {
          disposition: line.disposition,
          dispositionNote: line.dispositionNote,
          allowanceMinor: line.allowanceMinor,
        },
      })),
      actor,
    )

    const escalate = needsFinanceApproval(factsOf(patched))
    const updated = await this.repository.patch(patched.id, patched.versionLock, {
      needFinanceApproval: escalate,
      updatedBy: actor.userCode,
    })
    if (!updated) throw new BizError(SALES_RETURN_ERRORS.NOT_EDITABLE)

    if (escalate) {
      // 通知发给业务员本人而不是「财务部」：平台通知按唯一编码投递，
      // 没有部门收件箱。业务员据此去催审批，财务侧的待办由工作台按状态聚合。
      await this.notifications.notify({
        recipientUserCode: updated.ownerUserCode,
        category: 'SALES_RETURN',
        title: `退货处置待财务审批：${updated.docNo}`,
        body: '该退货涉及退款 / 补货 / 让步，按控制矩阵需财务与总经办审批。',
        docType: DOC_TYPES.SALES_RETURN,
        docId: updated.docNo,
      })
    }

    return updated
  }

  /** RMA-03 批准：涉及财务的必须由财务权限批。批准后进入执行。 */
  async approve(id: string, versionLock: number, actor: ReturnActor): Promise<SalesReturnRecord> {
    const current = await this.returns.load(id)
    if (current.needFinanceApproval) {
      SalesReturnService.assertFinance(actor)
    } else {
      SalesReturnService.assertSales(actor)
    }

    assertDispositionsResolved(current)

    return this.advance(current, versionLock, 'EXECUTING', actor, {
      approvedAt: new Date(),
      approvedBy: actor.userCode,
    })
  }

  /** 客诉不成立。理由必填——没写清的「不成立」在下一次同类客诉里毫无参考价值。 */
  async reject(
    id: string,
    versionLock: number,
    reason: string,
    actor: ReturnActor,
  ): Promise<SalesReturnRecord> {
    SalesReturnService.assertQuality(actor)
    const trimmed = reason.trim()
    if (!trimmed) throw new BizError(SALES_RETURN_ERRORS.REJECT_REASON_REQUIRED)

    const current = await this.returns.load(id)
    return this.advance(current, versionLock, 'REJECTED', actor, { rejectReason: trimmed })
  }

  /**
   * RMA-04：登记不良品实物入库（不良仓）。
   *
   * 单独一个动作而不是处置枚举里的一个值：「货回来了没有」是仓储事实，
   * 与「谁掏钱」正交。返工的行必须先过这一步——没收到货就没法开工。
   */
  async receiveGoods(
    id: string,
    versionLock: number,
    lines: ReadonlyArray<{ lineId: string; receivedQty: string }>,
    actor: ReturnActor,
  ): Promise<SalesReturnRecord> {
    SalesReturnService.assertSales(actor)
    const current = await this.returns.load(id)

    const byId = new Map(current.lines.map((line) => [line.id, line]))
    for (const input of lines) {
      const line = byId.get(input.lineId)
      if (!line) throw new BizError(SALES_RETURN_ERRORS.LINE_NOT_FOUND)
      if (line.receivedAt) {
        throw new BizError(SALES_RETURN_ERRORS.RECEIPT_ALREADY_RECORDED, {
          details: { sequence: line.sequence, receivedAt: line.receivedAt.toISOString() },
        })
      }
    }

    const now = new Date()
    const updated = await this.applyLinePatches(
      current,
      versionLock,
      lines.map((line) => ({
        lineId: line.lineId,
        patch: { receivedAt: now, receivedQty: line.receivedQty },
      })),
      actor,
    )

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'sales-return.receive-goods',
      entityType: 'SalesReturn',
      entityId: updated.docNo,
      after: { receivedLines: lines.map((line) => line.lineId) },
    })

    return updated
  }

  /**
   * RMA-05 结案。本模块唯一产生财务后果的动作。
   *
   * 顺序是有意的：先过闸门 → 再改状态（此刻金额锁死）→ 再发事件与推财务。
   * 反过来先发事件，闸门失败时下游已经收到一张根本没结成的案。
   */
  async close(id: string, versionLock: number, actor: ReturnActor): Promise<SalesReturnRecord> {
    SalesReturnService.assertSales(actor)
    const current = await this.returns.load(id)
    assertClosable(current)

    const closed = await this.advance(current, versionLock, 'CLOSED', actor, {
      closedAt: new Date(),
    })

    await this.announceRework(closed)
    await this.announceClosure(closed)
    await this.pushSettlement(closed)

    return closed
  }

  /** 判为返工的行送去 rework 模块拆工单；一行返工都没有就不发——空事件是噪音。 */
  private async announceRework(record: SalesReturnRecord): Promise<void> {
    const rework = reworkLines(factsOf(record))
    if (rework.length === 0) return

    await this.events.publish({
      name: DOMAIN_EVENTS.SALES_RETURN_REWORK_REQUESTED,
      payload: {
        returnId: record.id,
        docNo: record.docNo,
        customerId: record.customerId,
        orderId: record.orderId,
        lines: rework.map((line) => ({ sequence: line.sequence, productName: line.productName })),
      },
    })
  }

  private async announceClosure(record: SalesReturnRecord): Promise<void> {
    await this.events.publish({
      name: DOMAIN_EVENTS.SALES_RETURN_CLOSED,
      payload: {
        returnId: record.id,
        docNo: record.docNo,
        customerId: record.customerId,
        currency: record.currency,
        closedAt: record.closedAt?.toISOString() ?? null,
      },
    })

    await this.notifications.notify({
      recipientUserCode: record.ownerUserCode,
      category: 'SALES_RETURN',
      title: `退货已结案：${record.docNo}`,
      body: '金额与处置已锁定，对账单将在结案期间计入退货折让。',
      docType: DOC_TYPES.SALES_RETURN,
      docId: record.docNo,
    })
  }

  /** 只把动钱的行推给财务 seam；返工、补货不动钱，推过去只会让财务再过滤一遍。 */
  private async pushSettlement(record: SalesReturnRecord): Promise<void> {
    const payable = record.lines
      .filter((line) => deductionTypeOf(line.disposition) !== null)
      .map((line) => ({
        lineId: line.id,
        sequence: line.sequence,
        productName: line.productName,
        disposition: line.disposition,
        deductionMinor: deductionMinorOf(line),
        reason: line.dispositionNote ?? line.reason,
      }))

    if (payable.length === 0) return

    await this.settlement.submitSettlement({
      returnId: record.id,
      docNo: record.docNo,
      customerId: record.customerId,
      currency: record.currency,
      lines: payable,
    })
  }

  private async applyLinePatches(
    current: SalesReturnRecord,
    versionLock: number,
    patches: ReadonlyArray<{ lineId: string; patch: SalesReturnLinePatch }>,
    actor: ReturnActor,
  ): Promise<SalesReturnRecord> {
    const updated = await this.repository.patchLines(
      current.id,
      versionLock,
      patches,
      actor.userCode,
    )
    if (!updated) throw new BizError(SALES_RETURN_ERRORS.NOT_EDITABLE)
    return updated
  }

  private async advance(
    current: SalesReturnRecord,
    versionLock: number,
    target: SalesReturnStatus,
    actor: ReturnActor,
    extra: Omit<SalesReturnPatch, 'status' | 'updatedBy'>,
  ): Promise<SalesReturnRecord> {
    salesReturnStateMachine.assert(current.status, target)

    const updated = await this.repository.patch(current.id, versionLock, {
      ...extra,
      status: target,
      updatedBy: actor.userCode,
    })
    if (!updated) throw new BizError(SALES_RETURN_ERRORS.NOT_EDITABLE)

    const node = returnTimelineNodeFor(target)
    if (node) {
      await this.timeline.enter({
        docType: DOC_TYPES.SALES_RETURN,
        docId: updated.id,
        node: node.node,
        ownerUserCode: actor.userCode,
        ownerDept: node.ownerDept,
      })
    }

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: `sales-return.${target.toLowerCase().replace(/_/gu, '-')}`,
      entityType: 'SalesReturn',
      entityId: updated.docNo,
      before: { status: current.status },
      after: { status: updated.status },
    })

    return updated
  }
}

/** 服务层与规则层之间的转换；规则层只看事实，不认识 Prisma 记录。 */
export function factsOf(record: SalesReturnRecord): ReturnLineFacts[] {
  return record.lines.map((line) => ({
    sequence: line.sequence,
    productName: line.productName,
    responsibility: line.responsibility,
    disposition: line.disposition,
    dispositionNote: line.dispositionNote,
    amountMinor: line.amountMinor,
    allowanceMinor: line.allowanceMinor,
    receivedAt: line.receivedAt,
  }))
}

/**
 * 批准闸门：处置与责任都定了才批得下去。
 * 返工要求「先收到货」那条不在这里管——批准的是方案，收货是执行环节的事。
 */
export function assertDispositionsResolved(record: SalesReturnRecord): void {
  const blocking = collectClosureIssues(factsOf(record)).filter(
    (issue) => issue.kind !== 'GOODS_NOT_RECEIVED',
  )
  if (blocking.length === 0) return

  throw errorFor(blocking[0]?.kind ?? 'DISPOSITION_UNDECIDED', record.docNo, blocking)
}

/** 结案闸门：批准闸门的全部条件，外加返工行必须已经收到不良品。 */
export function assertClosable(record: SalesReturnRecord): void {
  const facts = factsOf(record)
  const issues = collectClosureIssues(facts)
  if (issues.length === 0) return

  throw errorFor(issues[0]?.kind ?? 'DISPOSITION_UNDECIDED', record.docNo, issues)
}

/** 返工行是否都已收到不良品——供读侧提示用，不抛异常。 */
export function pendingReceiptLines(record: SalesReturnRecord): number[] {
  return record.lines
    .filter((line) => requiresGoodsReceipt(line.disposition) && line.receivedAt === null)
    .map((line) => line.sequence)
}

const ISSUE_TO_ERROR = {
  RESPONSIBILITY_UNDECIDED: SALES_RETURN_ERRORS.LINE_DISPOSITION_REQUIRED,
  DISPOSITION_UNDECIDED: SALES_RETURN_ERRORS.LINE_DISPOSITION_REQUIRED,
  REASON_MISSING: SALES_RETURN_ERRORS.DISPOSITION_REASON_REQUIRED,
  ALLOWANCE_MISSING: SALES_RETURN_ERRORS.ALLOWANCE_AMOUNT_REQUIRED,
  ALLOWANCE_TOO_LARGE: SALES_RETURN_ERRORS.ALLOWANCE_EXCEEDS_LINE,
  GOODS_NOT_RECEIVED: SALES_RETURN_ERRORS.GOODS_NOT_RECEIVED,
} as const

function errorFor(
  kind: keyof typeof ISSUE_TO_ERROR,
  docNo: string,
  issues: ReadonlyArray<{ sequence: number; productName: string; detail: string }>,
): BizError {
  // 一次把全部问题都带上：业务员改一轮就该能过，不该被逼着一条一条试
  return new BizError(ISSUE_TO_ERROR[kind], {
    details: {
      docNo,
      issues: issues.map((issue) => `第 ${issue.sequence} 行 ${issue.productName}：${issue.detail}`),
    },
  })
}
