import { Injectable } from '@nestjs/common'

import { SalesOrderService } from '../../contract-order'
import { ShipmentService } from '../../shipment'
import { ANALYTICS_LIMITS, DAILY_OPS_CALIBER, DAILY_OPS_WINDOW_DAYS } from '../constants/analytics-periods'

import {
  dateKeyOf,
  dateKeysBackFrom,
  sumQuantity,
  toTenThousand,
} from './analytics-aggregation.rules'

import type { SalesOrderRecord } from '../../contract-order'
import type { ShipmentRecord } from '../../shipment'
import type { DailyOpsReport, DailyOpsRow } from '@machining-erp/shared'

/**
 * 每日经营量（规格第 11 章）。fixture 头部写死了三条口径，这里逐条照做：
 *
 * - **接单量** = 当日业务经理审核通过（ORD-02）的订单 → 按 `approvedAt` 归集。
 *   不是按建单日：草稿躺三天再批，产能压力落在批准那天。
 * - **出货量** = 当日实际发货（SHP-04）的发货单 → 按 `shippedAt` 归集。
 * - **未完成订单** = 截至当日日终，已评审通过但尚未全部出货的**存量**。
 *   存量指标，不是当日发生额——这是三条里最容易算错的一条。
 */
@Injectable()
export class DailyOpsService {
  constructor(
    private readonly orders: SalesOrderService,
    private readonly shipments: ShipmentService,
  ) {}

  async report(asOf: Date): Promise<DailyOpsReport> {
    const [orders, shipments] = await Promise.all([
      this.orders.list({ limit: ANALYTICS_LIMITS.ORDERS }),
      this.shipments.list({ limit: ANALYTICS_LIMITS.SHIPMENTS }),
    ])

    const keys = dateKeysBackFrom(asOf, DAILY_OPS_WINDOW_DAYS)
    const rows = keys.map((key) => buildDailyRow(key, orders, shipments))

    return {
      rows,
      caliber: DAILY_OPS_CALIBER,
      updatedAt: `${dateKeyOf(asOf)} 23:59`,
    }
  }
}

/** 订单行金额 = 数量 × 单价；订单头上没有总额字段，只能逐行算。 */
export function orderAmountMinor(order: SalesOrderRecord): bigint {
  return order.lines.reduce(
    (total, line) => total + BigInt(Math.round(Number(line.quantity) * Number(line.unitPriceMinor))),
    0n,
  )
}

export function orderQty(order: SalesOrderRecord): number {
  return sumQuantity(order.lines.map((line) => line.quantity))
}

/**
 * 出货金额同样逐行算。**无偿补发的那一票不计入**——
 * 与对账单发货列同一条口径（业务规格第 8 章「补发不另收费」）。
 */
export function shipmentAmountMinor(shipment: ShipmentRecord): bigint {
  return shipment.lines.reduce(
    (total, line) => total + BigInt(Math.round(Number(line.shippedQty) * Number(line.unitPriceMinor))),
    0n,
  )
}

export function shipmentQty(shipment: ShipmentRecord): number {
  return sumQuantity(shipment.lines.map((line) => line.shippedQty))
}

function isRevenueShipment(shipment: ShipmentRecord): boolean {
  return shipment.replacesReturnId === null
}

/**
 * 日终未完成订单存量：**当日或之前批过、且当日日终尚未全部发完**的订单。
 *
 * 「全部发完」按订单状态判：COMPLETED 表示各行都发清了（由出货过账回写）。
 * 用状态而不是自己再比一遍数量，是因为回写规则住在 contract-order，
 * 在这里重算一遍就等于把那条规则抄了第二份。
 */
export function openOrdersAt(orders: readonly SalesOrderRecord[], dayEnd: Date): SalesOrderRecord[] {
  return orders.filter((order) => {
    if (!order.approvedAt || order.approvedAt.getTime() > dayEnd.getTime()) return false
    return order.status === 'APPROVED' || order.status === 'EXECUTING'
  })
}

function endOfDay(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year!, (month ?? 1) - 1, day ?? 1, 23, 59, 59, 999)
}

function buildDailyRow(
  key: string,
  orders: readonly SalesOrderRecord[],
  shipments: readonly ShipmentRecord[],
): DailyOpsRow {
  const received = orders.filter((order) => order.approvedAt && dateKeyOf(order.approvedAt) === key)
  const shipped = shipments
    .filter(isRevenueShipment)
    .filter((shipment) => shipment.shippedAt && dateKeyOf(shipment.shippedAt) === key)
  const open = openOrdersAt(orders, endOfDay(key))

  return {
    date: key,
    receivedOrders: received.length,
    receivedQty: received.reduce((total, order) => total + orderQty(order), 0),
    receivedAmount: toTenThousand(received.reduce((total, order) => total + orderAmountMinor(order), 0n)),
    shippedOrders: shipped.length,
    shippedQty: shipped.reduce((total, shipment) => total + shipmentQty(shipment), 0),
    shippedAmount: toTenThousand(
      shipped.reduce((total, shipment) => total + shipmentAmountMinor(shipment), 0n),
    ),
    openOrders: open.length,
    openQty: open.reduce((total, order) => total + orderQty(order), 0),
    openAmount: toTenThousand(open.reduce((total, order) => total + orderAmountMinor(order), 0n)),
  }
}
