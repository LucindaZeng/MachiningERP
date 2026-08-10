import { BOM_ERRORS, PERMISSION_CODES } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOMAIN_EVENTS, DomainEventPublisher } from '../../../platform/events'
import { NotificationService } from '../../../platform/notification'
import { DOC_TYPES } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { bomRequestStateMachine } from '../constants/bom-request-states'
import {
  BOM_REQUEST_REPOSITORY,
  type BomRequestRecord,
  type BomRequestRepositoryPort,
} from '../repositories/bom-request.repository.port'

import { BomRequestService, type BomActor } from './bom-request.service'

import type { BomRequestStatus } from '@prisma/client'

/**
 * BOM 申请：工程侧回传（ENG-05）。
 *
 * **BOM 可下单与程序可开工是两个独立开关**，界面上必须分别显示，
 * 不得合并成一个「全部工程完成」。所以这里提供两个独立入口
 * `completeBom` / `completeProgram`，状态由两个开关推导（`deriveStatus`），
 * 而不是让调用方直接设状态。
 *
 * 对外的信号相应地也是两级，各管各的闸：
 * - `bom-request.bom-ready`：BOM 开关一合上就发 → **解锁下单**，同时通知业务员。
 *   程序编制（ENG-04）与订单审批、采购并行跑，程序卡的是开工，不是下单。
 * - `bom-request.completed`：两个开关都合上才发 → 留给 MES 开工放行与工程时效统计。
 *
 * 两条各自「一张申请只发一次」，且顺序无所谓：程序先编完时，
 * 合上 BOM 的那一步会在同一次调用里把两条都发出去。
 */
@Injectable()
export class BomEngineeringService {
  constructor(
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly timeline: DocTimelineService,
    private readonly events: DomainEventPublisher,
    private readonly requests: BomRequestService,
    @Inject(BOM_REQUEST_REPOSITORY) private readonly repository: BomRequestRepositoryPort,
  ) {}

  static assertEngineering(actor: BomActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.ENGINEERING_BOM_HANDLE)) {
      throw new BizError(BOM_ERRORS.ENGINEERING_ROLE_REQUIRED)
    }
  }

  /** 工程接收，开始建立。 */
  async claim(id: string, versionLock: number, actor: BomActor): Promise<BomRequestRecord> {
    BomEngineeringService.assertEngineering(actor)
    const current = await this.requests.load(id)
    bomRequestStateMachine.assert(current.status, 'CLAIMED')

    const now = new Date()
    const updated = await this.patch(id, versionLock, {
      status: 'CLAIMED',
      claimedAt: now,
      claimedBy: actor.userCode,
      updatedBy: actor.userCode,
    })

    await this.timeline.enter({
      docType: DOC_TYPES.BOM_REQUEST,
      docId: id,
      node: 'BOM 建立',
      ownerUserCode: actor.userCode,
      ownerDept: '工程部',
      at: now,
    })

    return updated
  }

  /** 退回补料：必须写明缺什么，否则业务员不知道要补什么。 */
  async returnToSales(
    id: string,
    versionLock: number,
    reason: string,
    actor: BomActor,
  ): Promise<BomRequestRecord> {
    BomEngineeringService.assertEngineering(actor)
    const trimmed = reason.trim()
    if (!trimmed) throw new BizError(BOM_ERRORS.RETURN_REASON_REQUIRED)

    const current = await this.requests.load(id)
    bomRequestStateMachine.assert(current.status, 'RETURNED')

    const now = new Date()
    const updated = await this.patch(id, versionLock, {
      status: 'RETURNED',
      returnedAt: now,
      returnReason: trimmed,
      updatedBy: actor.userCode,
    })

    await this.timeline.enter({
      docType: DOC_TYPES.BOM_REQUEST,
      docId: id,
      node: '业务补料',
      ownerUserCode: current.ownerUserCode,
      ownerDept: '业务部',
      previousStatus: 'ABNORMAL',
      at: now,
    })
    await this.notify(current, `BOM 申请被退回：${current.docNo}`, `需要补充：${trimmed}`)

    return updated
  }

  /**
   * BOM 建立完成 → 发 `bom-ready` 解锁下单并通知业务员。
   * 量产回填品号，模具回填模具编号；两者都用同一个字段，但都不能为空。
   *
   * 「只发一次」由状态机兜底而不是靠标志位判断：BOM_DONE / ALL_DONE 都不能
   * 再转回自身，所以本方法对同一张申请只可能成功一次；BOM_DONE 也不在
   * RETURNED 的来源状态里，退回重来不会走到这条路上。
   */
  async completeBom(
    id: string,
    versionLock: number,
    productCode: string,
    actor: BomActor,
  ): Promise<BomRequestRecord> {
    BomEngineeringService.assertEngineering(actor)
    const trimmed = productCode.trim()
    if (!trimmed) throw new BizError(BOM_ERRORS.PRODUCT_CODE_REQUIRED)

    const current = await this.requests.load(id)
    const now = new Date()
    const status = deriveStatus(true, current.programReady)
    bomRequestStateMachine.assert(current.status, status)

    const updated = await this.patch(id, versionLock, {
      status,
      bomReady: true,
      bomReadyAt: now,
      productCode: trimmed,
      updatedBy: actor.userCode,
    })

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'bom-request.complete-bom',
      entityType: 'BomRequest',
      entityId: current.docNo,
      after: { productCode: trimmed, bomReady: true, programReady: current.programReady },
    })
    await this.announceBomReady(updated)
    await this.announceCompletion(updated, status, now)

    return updated
  }

  /** 程序编制完成：把另一个开关打开。合上第二个开关时同样触发完成播报。 */
  async completeProgram(
    id: string,
    versionLock: number,
    actor: BomActor,
  ): Promise<BomRequestRecord> {
    BomEngineeringService.assertEngineering(actor)
    const current = await this.requests.load(id)

    const now = new Date()
    const status = deriveStatus(current.bomReady, true)
    if (status !== current.status) bomRequestStateMachine.assert(current.status, status)

    const updated = await this.patch(id, versionLock, {
      status,
      programReady: true,
      programReadyAt: now,
      updatedBy: actor.userCode,
    })

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'bom-request.complete-program',
      entityType: 'BomRequest',
      entityId: current.docNo,
      after: { bomReady: current.bomReady, programReady: true },
    })
    await this.announceCompletion(updated, status, now)

    return updated
  }

  /**
   * BOM 就绪播报：通知业务员「可以下单了」，并发事件解锁下单前置。
   * contract-order 订阅本事件——跨模块只走领域事件或对方 index.ts，
   * 不互相 import 内部文件。
   */
  private async announceBomReady(record: BomRequestRecord): Promise<void> {
    await this.notify(
      record,
      `BOM 建立完成：${record.docNo}`,
      `${record.productName} 的 BOM 已建立，${labelOf(record)} ${record.productCode ?? ''}，可以下单了。`,
    )
    await this.events.publish({
      name: DOMAIN_EVENTS.BOM_REQUEST_BOM_READY,
      payload: this.signalPayload(record),
    })
  }

  /**
   * 全部工程完成播报：**两个开关都合上（ALL_DONE）才发**，单开一个不发。
   * 由 `completeBom` / `completeProgram` 中后合上的那一个触发，所以顺序无所谓，
   * 而且一份申请只会播报一次——ALL_DONE 之后不再有第三次开关动作。
   *
   * 这条不放行下单（那是 `bom-ready` 的事），留给 MES 开工放行与工程时效统计。
   */
  private async announceCompletion(
    record: BomRequestRecord,
    status: BomRequestStatus,
    at: Date,
  ): Promise<void> {
    if (status !== 'ALL_DONE') return

    await this.timeline.close(DOC_TYPES.BOM_REQUEST, record.id, 'DONE', at)
    await this.notify(
      record,
      `全部工程完成：${record.docNo}`,
      `${record.productName} 的 BOM 与加工程序均已完成，可以安排开工。`,
    )
    await this.events.publish({
      name: DOMAIN_EVENTS.BOM_REQUEST_COMPLETED,
      payload: this.signalPayload(record),
    })
  }

  private signalPayload(record: BomRequestRecord): Record<string, unknown> {
    return {
      bomRequestId: record.id,
      docNo: record.docNo,
      quotationItemId: record.quotationItemId,
      drawingNo: record.drawingNo,
      drawingVersionId: record.drawingVersionId,
      productCode: record.productCode,
      productionType: record.productionType,
      ownerUserCode: record.ownerUserCode,
    }
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

  private notify(record: BomRequestRecord, title: string, body: string): Promise<unknown> {
    return this.notifications.notify({
      recipientUserCode: record.ownerUserCode,
      category: 'BOM_REQUEST',
      title,
      body,
      docType: DOC_TYPES.BOM_REQUEST,
      docId: record.docNo,
    })
  }
}

/**
 * 状态由两个开关推导，而不是由调用方指定。
 * 这样「BOM 好了但程序没好」永远落在 BOM_DONE，不会因为某个入口写错而跳到 ALL_DONE。
 */
export function deriveStatus(bomReady: boolean, programReady: boolean): 'CLAIMED' | 'BOM_DONE' | 'ALL_DONE' {
  if (bomReady && programReady) return 'ALL_DONE'
  if (bomReady) return 'BOM_DONE'
  return 'CLAIMED'
}

function labelOf(record: BomRequestRecord): string {
  return record.productionType === 'MOLD' ? '模具编号' : '品号'
}
