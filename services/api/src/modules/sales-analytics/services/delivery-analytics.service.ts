import { Injectable } from '@nestjs/common'

import { SalesOrderService } from '../../contract-order'
import { ShipmentService } from '../../shipment'
import { ANALYTICS_LIMITS } from '../constants/analytics-periods'

import {
  groupBy,
  groupWithShares,
  rateOf,
  sumQuantity,
  toTenThousand,
} from './analytics-aggregation.rules'
import { shipmentAmountMinor } from './daily-ops.service'

import type { SalesOrderRecord } from '../../contract-order'
import type { ShipmentRecord } from '../../shipment'
import type {
  LateReason,
  OnTimeRow,
  PartialShipRow,
  ShipmentAchieveRow,
} from '@machining-erp/shared'

/**
 * 交付分析：准交率、部分出货、出货达成（规格第 11 章）。
 *
 * 准交的判据是**实际发货日 vs 订单行交期**，逐行判而不是逐单判：
 * 一张单里三行两行准时一行迟到，按单算会把它整单记成迟到，
 * 客户感受到的却是「一部分到了」。
 */
@Injectable()
export class DeliveryAnalyticsService {
  constructor(
    private readonly orders: SalesOrderService,
    private readonly shipments: ShipmentService,
  ) {}

  /** 按客户的准交率。没有可判定的行时该客户不出现——**不是 0%**。 */
  async onTimeByCustomer(): Promise<OnTimeRow[]> {
    const [orders, shipments] = await this.sources()
    const dueByLine = deliveryDueIndex(orders)

    const judged = shipments
      .filter((shipment) => shipment.shippedAt !== null)
      .flatMap((shipment) =>
        shipment.lines.map((line) => ({
          customer: shipment.customerId,
          shippedAt: shipment.shippedAt as Date,
          dueAt: dueByLine.get(line.orderLineId) ?? null,
        })),
      )
      .filter((item): item is { customer: string; shippedAt: Date; dueAt: Date } => item.dueAt !== null)

    return [...groupBy(judged, (item) => item.customer)]
      .map(([customer, items]) => {
        const late = items.filter((item) => item.shippedAt.getTime() > item.dueAt.getTime())
        return {
          customer,
          total: items.length,
          late: late.length,
          rate: rateOf(items.length - late.length, items.length) ?? 0,
        }
      })
      .sort((left, right) => left.customer.localeCompare(right.customer))
  }

  /**
   * 迟交原因分布。
   *
   * 现阶段只能分出「订单行有交期但发晚了」这一类——**具体原因住在生产与品质侧**，
   * 分析层没有权限也没有资格替它们编一个原因。因此这里只给出一条汇总，
   * 细分等 MES / QMS 上线后由那两个域提供。
   */
  async lateReasons(): Promise<LateReason[]> {
    const rows = await this.onTimeByCustomer()
    const late = rows.reduce((total, row) => total + row.late, 0)
    if (late === 0) return []

    return [{ reason: '交期内未发出（细分原因待生产与品质模块上线）', count: late, share: 1 }]
  }

  /**
   * 部分出货：订单行已发数 < 订单数且已发过货。
   * 完全没发的不算部分出货——那是还没开始，不是发了一半。
   */
  async partialShipments(): Promise<PartialShipRow[]> {
    const [orders, shipments] = await this.sources()
    const shippedByLine = shippedQtyIndex(shipments)

    return orders
      .flatMap((order) =>
        order.lines.map((line) => {
          const shipped = shippedByLine.get(line.id) ?? 0
          const ordered = Number(line.quantity)
          return {
            orderNo: order.docNo,
            customer: order.customerId,
            productName: line.productName,
            orderQty: ordered,
            shippedQty: shipped,
            remainQty: Math.max(ordered - shipped, 0),
            // 尾数路径住在出货单上，未处置时如实留空而不是猜一个
            tailPath: '待处置',
            dueDate: line.deliveryDate ? line.deliveryDate.toISOString().slice(0, 10) : '—',
            note: '',
          }
        }),
      )
      .filter((row) => row.shippedQty > 0 && row.shippedQty < row.orderQty)
      .sort((left, right) => right.remainQty - left.remainQty)
  }

  /** 出货达成：按月对比计划（订单交期落在该月）与实际发出。 */
  async achievement(): Promise<ShipmentAchieveRow[]> {
    const [orders, shipments] = await this.sources()

    const planned = groupBy(
      orders.flatMap((order) =>
        order.lines
          .filter((line) => line.deliveryDate !== null)
          .map((line) => ({
            month: line.deliveryDate!.toISOString().slice(0, 7),
            qty: Number(line.quantity),
          })),
      ),
      (item) => item.month,
    )
    const actual = groupBy(
      shipments
        .filter((shipment) => shipment.shippedAt !== null && shipment.replacesReturnId === null)
        .map((shipment) => ({
          month: shipment.shippedAt!.toISOString().slice(0, 7),
          qty: sumQuantity(shipment.lines.map((line) => line.shippedQty)),
          amountMinor: shipmentAmountMinor(shipment),
        })),
      (item) => item.month,
    )

    const months = [...new Set([...planned.keys(), ...actual.keys()])].sort()
    return months.map((month) => {
      const plannedQty = (planned.get(month) ?? []).reduce((total, item) => total + item.qty, 0)
      const actualRows = actual.get(month) ?? []
      const actualQty = actualRows.reduce((total, item) => total + item.qty, 0)
      return {
        month,
        planned: plannedQty,
        actual: actualQty,
        rate: rateOf(actualQty, plannedQty) ?? 0,
      }
    })
  }

  /** 客户维度的出货占比，供占比图使用。 */
  async shareByCustomer(): Promise<Array<{ customerId: string; amount: number; share: number }>> {
    const [, shipments] = await this.sources()

    return groupWithShares(
      shipments.filter((item) => item.shippedAt !== null && item.replacesReturnId === null),
      (item) => item.customerId,
      shipmentAmountMinor,
    ).map((group) => ({
      customerId: group.key,
      amount: toTenThousand(group.amountMinor),
      share: group.share,
    }))
  }

  private sources(): Promise<[SalesOrderRecord[], ShipmentRecord[]]> {
    return Promise.all([
      this.orders.list({ limit: ANALYTICS_LIMITS.ORDERS }),
      this.shipments.list({ limit: ANALYTICS_LIMITS.SHIPMENTS }),
    ])
  }
}

/** 订单行 → 交期。准交判定的分母就是这张表。 */
export function deliveryDueIndex(orders: readonly SalesOrderRecord[]): Map<string, Date> {
  const index = new Map<string, Date>()
  for (const order of orders) {
    for (const line of order.lines) {
      if (line.deliveryDate) index.set(line.id, line.deliveryDate)
    }
  }
  return index
}

/** 订单行 → 累计已发数。补发的那一票不计——它不推进订单进度。 */
export function shippedQtyIndex(shipments: readonly ShipmentRecord[]): Map<string, number> {
  const index = new Map<string, number>()
  for (const shipment of shipments) {
    if (shipment.shippedAt === null || shipment.replacesReturnId !== null) continue
    for (const line of shipment.lines) {
      index.set(line.orderLineId, (index.get(line.orderLineId) ?? 0) + Number(line.shippedQty))
    }
  }
  return index
}
