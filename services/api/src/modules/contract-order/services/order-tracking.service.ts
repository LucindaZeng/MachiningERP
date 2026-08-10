import { ORDER_ERRORS, PERMISSION_CODES } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import {
  ORDER_TRACKING_REPOSITORY,
  type OrderTrackingRepositoryPort,
  type TrackingNodeDraft,
  type TrackingNodeRecord,
} from '../repositories/order-tracking.repository.port'

import { SalesOrderService, type OrderActor } from './sales-order.service'
import { aggregateLineProgress, clampDone, type OrderLineProgress } from './tracking-progress'
import { trimTrackingRoute } from './tracking-route'

import type { TrackNodeStatus } from '@prisma/client'

/**
 * 进度事件。来源只有三处：MES 扫码、检验记录、仓库过账。
 *
 * 刻意**不叫 update 而叫 event**：这是「某件事发生了」的记录，
 * 不是「把进度设成某个值」的指令。业务员没有能产生这种事件的途径。
 */
export interface TrackingEvent {
  orderLineId: string
  sequence: number
  status: TrackNodeStatus
  qtyIn?: string
  qtyOk?: string
  qtyNg?: string
  occurredAt: Date
  remark?: string
  /** 事件来源，用于审计与排障 */
  source: 'MES' | 'QMS' | 'WMS'
}

/**
 * 订单追踪（业务规格 4.7）。
 *
 * 两条硬约束：
 *
 * 1. **进度不允许手工填报**——`applyEvent` 只接受来自 MES/检验/仓库的事件，
 *    没有任何一个公开端点能让业务员直接改数字；`assertNotManual` 是最后一道闸。
 * 2. **进度是「完成数/工单数」**——聚合逻辑在 `tracking-progress.ts`，
 *    对外契约里没有百分比字段。
 *
 * 节点链在订单批准时按产品工艺路线建立并自动裁剪。
 */
@Injectable()
export class OrderTrackingService {
  constructor(
    @Inject(ORDER_TRACKING_REPOSITORY) private readonly repository: OrderTrackingRepositoryPort,
  ) {}

  /**
   * 建链：订单批准后按各行的工艺路线生成节点。
   * 追踪起点是订单评审，所以第一个节点建好即为已完成。
   */
  async buildRoute(orderLineId: string, processCodes: readonly string[]): Promise<TrackingNodeRecord[]> {
    const nodes: TrackingNodeDraft[] = trimTrackingRoute(processCodes).map((node) => ({
      orderLineId,
      sequence: node.sequence,
      processCode: node.processCode,
      node: node.node,
      phase: node.phase,
      department: node.department,
      status: 'PENDING' as TrackNodeStatus,
      qtyIn: null,
      qtyOk: null,
      qtyNg: null,
      startedAt: null,
      finishedAt: null,
      remark: null,
    }))

    return this.repository.replaceNodes(orderLineId, nodes)
  }

  /**
   * 事件驱动的进度推进。合格数超过投入数时截断——
   * 上游报数有误时宁可截断，也不能让完成数大于工单数。
   */
  async applyEvent(event: TrackingEvent): Promise<TrackingNodeRecord> {
    const node = await this.repository.findNode(event.orderLineId, event.sequence)
    if (!node) {
      throw new BizError(ORDER_ERRORS.ORDER_NOT_FOUND, {
        message: `订单行 ${event.orderLineId} 上没有第 ${event.sequence} 个追踪节点`,
      })
    }

    const qtyIn = event.qtyIn ?? node.qtyIn
    const qtyOk = event.qtyOk === undefined ? node.qtyOk : clampDone(event.qtyOk, qtyIn ?? event.qtyOk)

    const updated = await this.repository.updateNode(node.id, {
      status: event.status,
      qtyIn,
      qtyOk,
      qtyNg: event.qtyNg ?? node.qtyNg,
      startedAt: node.startedAt ?? event.occurredAt,
      finishedAt: event.status === 'DONE' ? event.occurredAt : null,
      remark: event.remark ?? node.remark,
    })
    if (!updated) throw new BizError(ORDER_ERRORS.ORDER_NOT_FOUND)

    return updated
  }

  /**
   * 业务员想直接改进度时的拦截点。
   * 单独留一个方法而不是在 controller 里写 if：任何将来新增的写入路径
   * 都应该先过这里，才不会绕开这条规则。
   */
  static assertNotManual(): never {
    throw new BizError(ORDER_ERRORS.TRACKING_MANUAL_UPDATE_FORBIDDEN)
  }

  async lineProgress(orderLineId: string, orderQty: string): Promise<OrderLineProgress> {
    const nodes = await this.repository.listByOrderLine(orderLineId)
    return aggregateLineProgress(nodes, orderQty)
  }

  /** 一单多产品时按行分别追踪，由调用方决定怎么在订单头汇总。 */
  async orderProgress(orderId: string, qtyByLine: Map<string, string>): Promise<Map<string, OrderLineProgress>> {
    const grouped = await this.repository.listByOrder(orderId)
    const result = new Map<string, OrderLineProgress>()

    for (const [orderLineId, nodes] of grouped) {
      result.set(orderLineId, aggregateLineProgress(nodes, qtyByLine.get(orderLineId) ?? '0'))
    }
    return result
  }

  /** 业务部、总经办、PMC 三方均可查看（业务规格 4.7）。 */
  static assertCanView(actor: OrderActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.ORDER_TRACKING_VIEW)) {
      SalesOrderService.assertSales(actor)
    }
  }
}
