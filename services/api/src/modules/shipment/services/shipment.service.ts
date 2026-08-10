import {
  PERMISSION_CODES,
  SHIPMENT_ERRORS,
  addQuantity,
  parseDecimal,
  quantityOf,
  subtractQuantity,
} from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { SHIPMENT_TIMELINE_NODES } from '../constants/shipment-timeline'
import {
  SHIPMENT_REPOSITORY,
  type ShipmentHeaderDraft,
  type ShipmentLineDraft,
  type ShipmentQuery,
  type ShipmentRecord,
  type ShipmentRepositoryPort,
} from '../repositories/shipment.repository.port'

import type { OrderLineFacts } from './shipment-context.service'

export interface ShipmentActor {
  userCode: string
  permissions: readonly string[]
}

const ZERO_QTY = quantityOf('0')

/**
 * 出货单主用例：建单（SHP-01 生成发货通知）、读取、列表。
 *
 * 建单时的三条硬校验都在这里：
 * 1. 至少一行，且每行必须挂在订单行上——脱离订单行的出货行既回写不了订单，也算不出尾数；
 * 2. 行引用的订单行必须属于本单关联的订单，防止把 A 单的货挂到 B 单头上；
 * 3. 本次发货数 + 该订单行历史已发数 ≤ 订单数，否则订单的未发量会变成负数。
 */
@Injectable()
export class ShipmentService {
  constructor(
    private readonly docNumber: DocNumberService,
    private readonly audit: AuditService,
    private readonly timeline: DocTimelineService,
    @Inject(SHIPMENT_REPOSITORY) private readonly repository: ShipmentRepositoryPort,
  ) {}

  static assertSales(actor: ShipmentActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.SALES_OPERATE)) {
      throw new BizError(SHIPMENT_ERRORS.SALES_ROLE_REQUIRED)
    }
  }

  async create(
    header: ShipmentHeaderDraft,
    lines: readonly ShipmentLineDraft[],
    orderLines: readonly OrderLineFacts[],
    actor: ShipmentActor,
  ): Promise<ShipmentRecord> {
    ShipmentService.assertSales(actor)
    const alreadyShipped = await this.repository.sumShippedByOrderLine(
      lines.map((line) => line.orderLineId),
    )
    assertShippableLines(lines, orderLines, alreadyShipped)

    const docNo = await this.docNumber.next(DOC_TYPES.SHIPMENT)
    const record = await this.repository.create({
      ...header,
      docNo,
      createdBy: actor.userCode,
      lines: [...lines],
    })

    await this.timeline.enter({
      docType: DOC_TYPES.SHIPMENT,
      docId: record.id,
      node: SHIPMENT_TIMELINE_NODES.PLANNED.node,
      ownerUserCode: actor.userCode,
      ownerDept: SHIPMENT_TIMELINE_NODES.PLANNED.ownerDept,
    })
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'shipment.create',
      entityType: 'Shipment',
      entityId: record.docNo,
      after: { orderId: record.orderId, lineCount: record.lines.length },
    })

    return record
  }

  async load(id: string): Promise<ShipmentRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new BizError(SHIPMENT_ERRORS.NOT_FOUND)
    return record
  }

  async loadByDocNo(docNo: string): Promise<ShipmentRecord> {
    const record = await this.repository.findByDocNo(docNo)
    if (!record) throw new BizError(SHIPMENT_ERRORS.NOT_FOUND)
    return record
  }

  list(query: ShipmentQuery): Promise<ShipmentRecord[]> {
    return this.repository.list(query)
  }
}

/**
 * 建单数量校验。三条一次跑完，第一条不过就直接抛——
 * 后两条依赖「行确实挂在订单行上」这个前提，先过完再谈。
 */
export function assertShippableLines(
  lines: readonly ShipmentLineDraft[],
  orderLines: readonly OrderLineFacts[],
  alreadyShipped: Readonly<Record<string, string>>,
): void {
  if (lines.length === 0 || lines.some((line) => !line.orderLineId)) {
    throw new BizError(SHIPMENT_ERRORS.LINES_REQUIRED)
  }

  const byId = new Map(orderLines.map((line) => [line.orderLineId, line]))
  for (const line of lines) {
    const orderLine = byId.get(line.orderLineId)
    if (!orderLine) {
      throw new BizError(SHIPMENT_ERRORS.ORDER_LINE_MISMATCH, {
        message: `出货第 ${line.sequence} 行引用的订单行不属于该订单`,
        details: { sequence: line.sequence, orderLineId: line.orderLineId },
      })
    }

    const shippedBefore = alreadyShipped[line.orderLineId] ?? ZERO_QTY
    const cumulative = addQuantity(shippedBefore, line.shippedQty)
    if (parseDecimal(cumulative, '数量').greaterThan(parseDecimal(orderLine.orderedQty, '数量'))) {
      throw new BizError(SHIPMENT_ERRORS.OVER_SHIPMENT, {
        message:
          `出货第 ${line.sequence} 行超发：订单数 ${orderLine.orderedQty}，` +
          `已发 ${shippedBefore}，本次还要发 ${line.shippedQty}`,
        details: {
          sequence: line.sequence,
          orderedQty: orderLine.orderedQty,
          shippedBefore,
          requested: line.shippedQty,
          remaining: subtractQuantity(orderLine.orderedQty, shippedBefore),
        },
      })
    }
  }
}
