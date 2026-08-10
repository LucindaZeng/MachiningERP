import { SHIPMENT_ERRORS, addQuantity, quantityOf } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOMAIN_EVENTS, DomainEventPublisher } from '../../../platform/events'
import { DOC_TYPES } from '../../../platform/numbering'
import { TAIL_PLAN_BY_WIRE, TAIL_PLAN_LABEL, isTailPlanWire } from '../constants/tail-plans'
import {
  SHIPMENT_REPOSITORY,
  type ShipmentRecord,
  type ShipmentRepositoryPort,
  type TailResolution,
} from '../repositories/shipment.repository.port'

import { ShipmentService, type ShipmentActor } from './shipment.service'
import { hasOutstandingTail, outstandingTailOf } from './tail-balance.rules'

import type { TailPlanResultView } from '../dto/tail-plan-result.dto'

const ZERO_QTY = quantityOf('0')

/**
 * 尾数四路径处理（V2.4 尾数规则）。
 *
 * 前端按**单据号**提交一个方案，因此这里把方案一次性应用到该单所有还有尾数的行：
 * 一张单里两行走不同路径的场景现实中不存在，真出现了也该拆两张单，
 * 而不是让结案校验去猜哪一行按哪条路结清。
 *
 * 「审批」在这里落成：动作需要业务操作权限 + 记录审批人与时刻（tailApprovedBy/At）
 * + 一条审计。返工路径额外发事件，交给未来的 rework 模块拆返工子订单。
 */
@Injectable()
export class ShipmentTailService {
  constructor(
    private readonly audit: AuditService,
    private readonly events: DomainEventPublisher,
    private readonly shipments: ShipmentService,
    @Inject(SHIPMENT_REPOSITORY) private readonly repository: ShipmentRepositoryPort,
  ) {}

  async applyByDocNo(
    docNo: string,
    plan: string,
    remark: string | null,
    actor: ShipmentActor,
  ): Promise<TailPlanResultView> {
    ShipmentService.assertSales(actor)
    if (!isTailPlanWire(plan)) throw new BizError(SHIPMENT_ERRORS.TAIL_PLAN_INVALID)

    const current = await this.shipments.loadByDocNo(docNo)
    const resolutions = buildResolutions(current, TAIL_PLAN_BY_WIRE[plan], remark, actor.userCode)
    if (resolutions.length === 0) throw new BizError(SHIPMENT_ERRORS.NO_TAIL_TO_PLAN)

    const updated = await this.repository.applyTailResolutions(
      current.id,
      current.versionLock,
      resolutions,
      actor.userCode,
    )
    if (!updated) throw new BizError(SHIPMENT_ERRORS.NOT_EDITABLE)

    const resolvedQty = resolutions.reduce(
      (sum, item) => addQuantity(sum, item.tailResolvedQty),
      ZERO_QTY,
    )

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'shipment.tail-plan',
      entityType: 'Shipment',
      entityId: current.docNo,
      after: {
        plan: TAIL_PLAN_LABEL[TAIL_PLAN_BY_WIRE[plan]],
        resolvedQty,
        lines: resolutions.map((item) => item.lineId),
      },
    })

    if (plan === 'rework') await this.publishRework(current, resolutions, resolvedQty)

    return { docNo: current.docNo, plan, resolvedQty, resolvedLines: resolutions.length }
  }

  /**
   * 返工补交要拆返工子订单，那是 rework 模块的事；这里只把事实播出去。
   * 明细直接取 resolution 上带的行快照，不回头去 shipment.lines 里找——
   * 那种反查会引入一条「找不到就填 null」的死分支，而 resolution 本来就是从行上算出来的。
   */
  private publishRework(
    shipment: ShipmentRecord,
    resolutions: readonly TailResolution[],
    resolvedQty: string,
  ): Promise<unknown> {
    return this.events.publish({
      name: DOMAIN_EVENTS.SHIPMENT_TAIL_REWORK_REQUESTED,
      payload: {
        shipmentId: shipment.id,
        docNo: shipment.docNo,
        orderId: shipment.orderId,
        customerId: shipment.customerId,
        totalReworkQty: resolvedQty,
        lines: resolutions.map((item) => ({
          shipmentLineId: item.lineId,
          orderLineId: item.orderLineId,
          drawingNo: item.drawingNo,
          batchNo: item.batchNo,
          reworkQty: item.tailResolvedQty,
        })),
        docType: DOC_TYPES.SHIPMENT,
      },
    })
  }
}

/** 只对「还有未结尾数」的行下方案；已经结清的行不重复处置。 */
export function buildResolutions(
  shipment: ShipmentRecord,
  tailPlan: TailResolution['tailPlan'],
  remark: string | null,
  actorUserCode: string,
): TailResolution[] {
  const at = new Date()

  return shipment.lines
    .filter(hasOutstandingTail)
    .map((line) => ({ line, outstanding: outstandingTailOf(line) }))
    .map(({ line, outstanding }) => ({
      lineId: line.id,
      orderLineId: line.orderLineId,
      drawingNo: line.drawingNo,
      batchNo: line.batchNo,
      tailPlan,
      // 一次结清该行全部未结尾数：留一半不结的话，结案校验永远过不了
      tailResolvedQty: addQuantity(line.tailResolvedQty, outstanding),
      tailApprovedBy: actorUserCode,
      tailApprovedAt: at,
      tailRemark: remark,
    }))
}
