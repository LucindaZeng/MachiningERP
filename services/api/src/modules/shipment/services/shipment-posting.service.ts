import { addQuantity, parseDecimal, quantityOf } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { DOMAIN_EVENTS, DomainEventPublisher } from '../../../platform/events'
import {
  SHIPMENT_REPOSITORY,
  type ShipmentRepositoryPort, ShipmentRecord 
} from '../repositories/shipment.repository.port'

import { lineAmountMinor } from './shipment-view.mapper'

import type { OrderLineFacts } from './shipment-context.service'

const ZERO_QTY = quantityOf('0')

/** 出货过账时随事件带出的逐行履约情况，contract-order 据此回写订单状态。 */
export interface PostedLinePayload {
  orderLineId: string
  shippedQty: string
  cumulativeShippedQty: string
  orderedQty: string
  fullyShipped: boolean
}

/**
 * 出货过账与签收的对外播报。
 *
 * 「回写订单状态（部分出货/全部出货）」这件事**不在这里直接改订单**：
 * 订单是 contract-order 的东西，本模块只把逐行履约事实播出去，由对方自己落状态
 * （开发指南 3.5：跨模块只走 index.ts 或领域事件）。
 * 本模块负责的是把「累计已发 / 订单数 / 是否发齐」算准——这两个数只有出货侧知道。
 */
@Injectable()
export class ShipmentPostingService {
  constructor(
    private readonly events: DomainEventPublisher,
    @Inject(SHIPMENT_REPOSITORY) private readonly repository: ShipmentRepositoryPort,
  ) {}

  /** 出货过账：推送应收依据 + 逐行履约，供财务建应收、contract-order 回写订单。 */
  async publishPosted(shipment: ShipmentRecord, orderLines: readonly OrderLineFacts[]): Promise<void> {
    const cumulative = await this.repository.sumShippedByOrderLine(
      shipment.lines.map((line) => line.orderLineId),
    )
    const lines = buildPostedLines(shipment, orderLines, cumulative)

    await this.events.publish({
      name: DOMAIN_EVENTS.SHIPMENT_POSTED,
      payload: {
        shipmentId: shipment.id,
        docNo: shipment.docNo,
        orderId: shipment.orderId,
        customerId: shipment.customerId,
        currency: shipment.currency,
        /** 应收依据金额（最小货币单位），字符串传递避免 JSON 丢 bigint */
        receivableMinor: shipment.lines
          .reduce((sum, line) => sum + lineAmountMinor(line), 0n)
          .toString(),
        shippedAt: shipment.shippedAt?.toISOString() ?? null,
        lines,
        allLinesFullyShipped: lines.every((line) => line.fullyShipped),
      },
    })
  }

  async publishSigned(shipment: ShipmentRecord): Promise<void> {
    await this.events.publish({
      name: DOMAIN_EVENTS.SHIPMENT_SIGNED,
      payload: {
        shipmentId: shipment.id,
        docNo: shipment.docNo,
        orderId: shipment.orderId,
        customerId: shipment.customerId,
        signedAt: shipment.signedAt?.toISOString() ?? null,
      },
    })
  }
}

/**
 * 逐行履约：累计已发取仓储层的合计（含本单），订单数取订单行。
 * 订单行查不到时按「未发齐」处理——宁可少推进一格，也不要把没发完的单标成已完成。
 */
export function buildPostedLines(
  shipment: ShipmentRecord,
  orderLines: readonly OrderLineFacts[],
  cumulativeByLine: Readonly<Record<string, string>>,
): PostedLinePayload[] {
  const byId = new Map(orderLines.map((line) => [line.orderLineId, line]))

  return shipment.lines.map((line) => {
    const orderLine = byId.get(line.orderLineId)
    const cumulative = cumulativeByLine[line.orderLineId] ?? addQuantity(ZERO_QTY, line.shippedQty)
    const orderedQty = orderLine?.orderedQty ?? ZERO_QTY

    return {
      orderLineId: line.orderLineId,
      shippedQty: line.shippedQty,
      cumulativeShippedQty: cumulative,
      orderedQty,
      fullyShipped: orderLine
        ? !parseDecimal(cumulative, '数量').lessThan(parseDecimal(orderedQty, '数量'))
        : false,
    }
  })
}
