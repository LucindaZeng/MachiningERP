import { SHIPMENT_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DOC_TYPES } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { shipmentStateMachine } from '../constants/shipment-states'
import { timelineNodeFor } from '../constants/shipment-timeline'
import {
  SHIPMENT_REPOSITORY,
  type ShipmentPatch,
  type ShipmentRecord,
  type ShipmentRepositoryPort,
} from '../repositories/shipment.repository.port'

import { ShipGateService } from './ship-gate.service'
import { ShipmentContextService } from './shipment-context.service'
import { ShipmentPostingService } from './shipment-posting.service'
import { ShipmentService, type ShipmentActor } from './shipment.service'
import { collectTailImbalances } from './tail-balance.rules'

import type { ShipmentStatus } from '@prisma/client'

/**
 * 出货节点推进（SHP-02~06 + 结案）。
 *
 * 每个动作都是一个端点而不是 PATCH status：这样每一步的执行人与时刻都能落审计，
 * 节点耗时也由平台 timeline 自动结算——「不允许手工填报进度」就是这么落的。
 */
@Injectable()
export class ShipmentFlowService {
  constructor(
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly timeline: DocTimelineService,
    private readonly shipments: ShipmentService,
    private readonly gate: ShipGateService,
    private readonly posting: ShipmentPostingService,
    private readonly context: ShipmentContextService,
    @Inject(SHIPMENT_REPOSITORY) private readonly repository: ShipmentRepositoryPort,
  ) {}

  /** SHP-02 仓库拣配出库。 */
  startPicking(id: string, versionLock: number, actor: ShipmentActor): Promise<ShipmentRecord> {
    return this.advance(id, versionLock, 'PICKING', actor, {})
  }

  /** SHP-03 全检包装完成（T1）。 */
  pack(id: string, versionLock: number, actor: ShipmentActor): Promise<ShipmentRecord> {
    return this.advance(id, versionLock, 'PACKED', actor, { packedAt: new Date() })
  }

  /**
   * SHP-04 出运发货。**双闸门在这一步**：品质放行 + 财务信用都过才放行，
   * 过账后推送应收依据并播报逐行履约供订单回写。
   */
  async ship(
    id: string,
    versionLock: number,
    carrier: string | null,
    trackingNo: string | null,
    actor: ShipmentActor,
  ): Promise<ShipmentRecord> {
    ShipmentService.assertSales(actor)
    const current = await this.shipments.load(id)
    shipmentStateMachine.assert(current.status, 'SHIPPED')

    const customer = await this.context.customerContext(current.customerId)
    await this.gate.assertShippable(current, customer.paymentTerm)

    const now = new Date()
    const updated = await this.patch(id, versionLock, {
      status: 'SHIPPED',
      shippedAt: now,
      carrier: carrier ?? current.carrier,
      trackingNo: trackingNo ?? current.trackingNo,
      updatedBy: actor.userCode,
    })

    await this.enterNode('SHIPPED', updated, actor, now)
    await this.recordTransition(current.status, updated, actor)

    const order = await this.context.orderContext(current.orderId)
    await this.posting.publishPosted(updated, order.lines)

    return updated
  }

  /** SHP-05 客户签收：开票与账期的起算点。 */
  async sign(id: string, versionLock: number, actor: ShipmentActor): Promise<ShipmentRecord> {
    const updated = await this.advance(id, versionLock, 'SIGNED', actor, { signedAt: new Date() })
    await this.posting.publishSigned(updated)
    return updated
  }

  /** SHP-06 开票与应收：发票号由财务开出后回填，供对账单勾稽。 */
  async invoice(
    id: string,
    versionLock: number,
    invoiceNo: string,
    actor: ShipmentActor,
  ): Promise<ShipmentRecord> {
    const trimmed = invoiceNo.trim()
    if (!trimmed) throw new BizError(SHIPMENT_ERRORS.NOT_EDITABLE, { message: '发票号不能为空' })

    return this.advance(id, versionLock, 'INVOICED', actor, {
      invoicedAt: new Date(),
      invoiceNo: trimmed,
    })
  }

  /**
   * 商业关闭。结案前做**数量平衡校验**：订单数 = 已发数 + 已处置尾数。
   * 少了这一条，尾数会连人带货一起从账上消失。
   */
  async close(id: string, versionLock: number, actor: ShipmentActor): Promise<ShipmentRecord> {
    ShipmentService.assertSales(actor)
    const current = await this.shipments.load(id)
    shipmentStateMachine.assert(current.status, 'CLOSED')

    const imbalances = collectTailImbalances(current.lines)
    if (imbalances.length > 0) {
      throw new BizError(SHIPMENT_ERRORS.TAIL_NOT_BALANCED, {
        message:
          `仍有 ${imbalances.length} 行尾数未处置：` +
          imbalances.map((row) => `第 ${row.sequence} 行 ${row.productName} 欠 ${row.outstandingQty}`).join('；'),
        details: { imbalances },
      })
    }

    const now = new Date()
    const updated = await this.patch(id, versionLock, {
      status: 'CLOSED',
      closedAt: now,
      updatedBy: actor.userCode,
    })

    await this.timeline.close(DOC_TYPES.SHIPMENT, id, 'DONE', now)
    await this.recordTransition(current.status, updated, actor)
    await this.notifications.notify({
      recipientUserCode: updated.ownerUserCode,
      category: 'SHIPMENT',
      title: `出货单已结案：${updated.docNo}`,
      body: '数量平衡校验通过，订单数 = 已发数 + 已处置尾数。',
      docType: DOC_TYPES.SHIPMENT,
      docId: updated.docNo,
    })

    return updated
  }

  /** 只推进节点、不带额外闸门的那几步共用同一段。 */
  private async advance(
    id: string,
    versionLock: number,
    target: ShipmentStatus,
    actor: ShipmentActor,
    extra: Omit<ShipmentPatch, 'status' | 'updatedBy'>,
  ): Promise<ShipmentRecord> {
    ShipmentService.assertSales(actor)
    const current = await this.shipments.load(id)
    shipmentStateMachine.assert(current.status, target)

    const now = new Date()
    const updated = await this.patch(id, versionLock, {
      ...extra,
      status: target,
      updatedBy: actor.userCode,
    })

    await this.enterNode(target, updated, actor, now)
    await this.recordTransition(current.status, updated, actor)

    return updated
  }

  private async enterNode(
    target: ShipmentStatus,
    record: ShipmentRecord,
    actor: ShipmentActor,
    at: Date,
  ): Promise<void> {
    const node = timelineNodeFor(target)
    if (!node) return

    await this.timeline.enter({
      docType: DOC_TYPES.SHIPMENT,
      docId: record.id,
      node: node.node,
      ownerUserCode: actor.userCode,
      ownerDept: node.ownerDept,
      at,
    })
  }

  private recordTransition(
    from: ShipmentStatus,
    record: ShipmentRecord,
    actor: ShipmentActor,
  ): Promise<unknown> {
    return this.audit.record({
      actorUserCode: actor.userCode,
      action: `shipment.${record.status.toLowerCase()}`,
      entityType: 'Shipment',
      entityId: record.docNo,
      before: { status: from },
      after: { status: record.status },
    })
  }

  private async patch(
    id: string,
    versionLock: number,
    patch: ShipmentPatch,
  ): Promise<ShipmentRecord> {
    const updated = await this.repository.patch(id, versionLock, patch)
    if (!updated) throw new BizError(SHIPMENT_ERRORS.NOT_EDITABLE)
    return updated
  }
}
