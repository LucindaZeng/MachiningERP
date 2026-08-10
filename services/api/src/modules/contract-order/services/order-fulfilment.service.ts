import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'

import { DOMAIN_EVENTS, DomainEventPublisher } from '../../../platform/events'
import {
  SALES_ORDER_REPOSITORY,
  type SalesOrderRepositoryPort,
} from '../repositories/sales-order.repository.port'

import type { SalesOrderStatus } from '@prisma/client'

interface PostedLine {
  fullyShipped?: boolean
}

interface ShipmentPostedPayload {
  orderId?: string
  docNo?: string
  lines?: PostedLine[]
  allLinesFullyShipped?: boolean
}

/**
 * 出货回写订单状态（业务规格第 7 章「出货后状态回写订单（部分出货/全部出货）」）。
 *
 * 订单状态枚举里没有单独的「部分出货/全部出货」两档，也不该为此加两个枚举值——
 * 现有的 EXECUTING / COMPLETED 正好表达同一件事：
 *   - 有货发出但还没发齐 → EXECUTING（执行中）
 *   - 所有订单行都发齐    → COMPLETED（已完成）
 * 结案（CLOSED）仍由业务在收款、对账之后自己按，不由出货自动推。
 *
 * 数据从 `sales.shipment.posted` 事件来，本服务**不 import shipment 模块任何东西**
 * （开发指南 3.5）。逐行「发齐没有」由出货侧算好带过来——只有它同时握着订单数与累计已发数。
 */
@Injectable()
export class OrderFulfilmentService implements OnModuleInit {
  private readonly logger = new Logger(OrderFulfilmentService.name)

  constructor(
    private readonly events: DomainEventPublisher,
    @Inject(SALES_ORDER_REPOSITORY) private readonly orders: SalesOrderRepositoryPort,
  ) {}

  onModuleInit(): void {
    this.events.subscribe(DOMAIN_EVENTS.SHIPMENT_POSTED, (event) => {
      void this.apply(event.payload as ShipmentPostedPayload)
    })
  }

  async apply(payload: ShipmentPostedPayload): Promise<void> {
    if (!payload.orderId) return

    const order = await this.orders.findById(payload.orderId)
    if (!order) {
      this.logger.warn(`出货 ${payload.docNo ?? '?'} 回写订单失败：订单 ${payload.orderId} 不存在`)
      return
    }

    const target = nextOrderStatus(order.status, payload.allLinesFullyShipped === true)
    if (!target) return

    const updated = await this.orders.updateStatus(order.id, order.versionLock, {
      status: target,
      updatedBy: 'system:shipment',
    })
    if (!updated) {
      // 乐观锁冲突：下一张出货单过账时会再算一次，这里不重试也不抛，避免把事件循环卡住
      this.logger.warn(`出货 ${payload.docNo ?? '?'} 回写订单 ${order.docNo} 遇到版本冲突，已跳过`)
    }
  }
}

/**
 * 目标状态。已经是 COMPLETED / CLOSED 的订单不再往回退，
 * 也不从审核链中途（还没批准）跳到执行中——那是流程被绕过的信号，不是出货该修的。
 */
export function nextOrderStatus(
  current: SalesOrderStatus,
  allLinesFullyShipped: boolean,
): SalesOrderStatus | null {
  if (current !== 'APPROVED' && current !== 'EXECUTING') return null
  if (allLinesFullyShipped) return 'COMPLETED'
  return current === 'EXECUTING' ? null : 'EXECUTING'
}
