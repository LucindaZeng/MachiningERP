import { Injectable } from '@nestjs/common'

import { SalesOrderService } from '../../contract-order'
import { ORDER_TYPE_LABEL, backlogBucketOf } from '../constants/analytics-labels'
import { ANALYTICS_LIMITS } from '../constants/analytics-periods'

import {
  daysBetween,
  groupBy,
  groupWithShares,
  monthKeyOf,
  toTenThousand,
} from './analytics-aggregation.rules'
import { orderAmountMinor, orderQty } from './daily-ops.service'

import type { SalesOrderRecord } from '../../contract-order'
import type {
  BacklogAlertRow,
  BacklogDimRow,
  BacklogMonthRow,
  BacklogRow,
  OrderMixRow,
  OrderTrendRow,
  OrderType5Row,
} from '@machining-erp/shared'

/** 在手订单：已批准、尚未发清。与日报的「未完成订单」同一判据，不另立口径。 */
export function isBacklog(order: SalesOrderRecord): boolean {
  return order.status === 'APPROVED' || order.status === 'EXECUTING'
}

/** 订单最近的一个交期——用于 backlog 按月归集与临期预警。 */
export function earliestDueOf(order: SalesOrderRecord): Date | null {
  const dates = order.lines
    .map((line) => line.deliveryDate)
    .filter((date): date is Date => date !== null)
  if (dates.length === 0) return null
  return dates.reduce((earliest, date) => (date < earliest ? date : earliest))
}

/**
 * 订单结构与在手订单分析（规格第 11 章）。
 *
 * 毛利率一律给 `null` 而不是 0：实际成本住在尚未上线的成本模块，
 * 报价成本算不出交付后的真实毛利。给 0 会读成「这类订单不赚钱」。
 */
@Injectable()
export class OrderAnalyticsService {
  constructor(private readonly orders: SalesOrderService) {}

  private load(): Promise<SalesOrderRecord[]> {
    return this.orders.list({ limit: ANALYTICS_LIMITS.ORDERS })
  }

  /** 五类订单结构。 */
  async orderType5(): Promise<OrderType5Row[]> {
    const orders = await this.load()

    return groupWithShares(
      orders,
      (order) => ORDER_TYPE_LABEL[order.orderType] ?? order.orderType,
      orderAmountMinor,
    ).map((group) => ({
      type: group.key,
      count: group.items.length,
      quantity: group.items.reduce((total, item) => total + orderQty(item), 0),
      amount: toTenThousand(group.amountMinor),
      share: group.share,
      // 实际毛利要等成本模块；null 表示「无数据」，与 0 是两回事
      marginRate: null,
      note: '毛利率待成本模块上线后补齐',
    }))
  }

  /** 订单结构（金额占比），SalesReports 用的简版。 */
  async orderMix(): Promise<OrderMixRow[]> {
    const rows = await this.orderType5()
    return rows.map((row) => ({
      type: row.type,
      count: row.count,
      amount: row.amount,
      share: row.share,
    }))
  }

  /** 按月的订单趋势；环比与同比在数据不足时给 0（相邻期缺失即无变化可言）。 */
  async orderTrend(): Promise<OrderTrendRow[]> {
    const orders = (await this.load()).filter((order) => order.approvedAt !== null)
    const groups = [...groupBy(orders, (order) => monthKeyOf(order.approvedAt as Date))].sort(
      (left, right) => left[0].localeCompare(right[0]),
    )

    const byMonth = new Map(
      groups.map(([month, items]) => [
        month,
        {
          amount: toTenThousand(items.reduce((sum, item) => sum + orderAmountMinor(item), 0n)),
          count: items.length,
        },
      ]),
    )

    return [...byMonth].map(([month, value], index) => {
      const previous = index > 0 ? [...byMonth.values()][index - 1] : null
      const lastYear = byMonth.get(shiftYear(month, -1)) ?? null
      return {
        month,
        amount: value.amount,
        count: value.count,
        yoy: growth(value.amount, lastYear?.amount ?? null),
        mom: growth(value.amount, previous?.amount ?? null),
      }
    })
  }

  /** 在手订单按交期分桶。 */
  async backlogBuckets(): Promise<BacklogRow[]> {
    const orders = (await this.load()).filter(isBacklog)
    const now = new Date()
    const groups = [...groupBy(orders, (order) => backlogBucketOf(daysBetween(now, earliestDueOf(order))))]

    return groups.map(([bucket, items]) => ({
      bucket,
      orders: items.length,
      amount: toTenThousand(items.reduce((sum, item) => sum + orderAmountMinor(item), 0n)),
      hint: `${items.length} 张在手订单落在该区间`,
    }))
  }

  /** 在手订单按月：产能负荷留空（排产在 PMC，分析层不替它估）。 */
  async backlogByMonth(): Promise<BacklogMonthRow[]> {
    const orders = (await this.load()).filter(isBacklog)
    const dated = orders.filter((order) => earliestDueOf(order) !== null)

    return [...groupBy(dated, (order) => monthKeyOf(earliestDueOf(order) as Date))]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([month, items]) => ({
        month,
        orders: items.length,
        quantity: items.reduce((total, item) => total + orderQty(item), 0),
        amount: toTenThousand(items.reduce((sum, item) => sum + orderAmountMinor(item), 0n)),
        // 产能负荷需要 PMC 的排产能力数据，这里不猜
        capacityLoad: 0,
        risk: 'ok' as const,
      }))
  }

  /** 在手订单按客户维度。 */
  async backlogByCustomer(): Promise<BacklogDimRow[]> {
    return this.backlogByDimension((order) => order.customerId)
  }

  /** 在手订单按产品维度（取首行产品名）。 */
  async backlogByProduct(): Promise<BacklogDimRow[]> {
    return this.backlogByDimension((order) => order.lines[0]?.productName ?? '未命名')
  }

  /** 临期与超期预警。 */
  async backlogAlerts(warnDays: number): Promise<BacklogAlertRow[]> {
    const orders = (await this.load()).filter(isBacklog)
    const now = new Date()

    return orders
      .map((order) => {
        const due = earliestDueOf(order)
        const daysLeft = daysBetween(now, due)
        return { order, due, daysLeft }
      })
      .filter((item): item is { order: SalesOrderRecord; due: Date; daysLeft: number } =>
        item.due !== null && item.daysLeft !== null && item.daysLeft <= warnDays,
      )
      .map(({ order, due, daysLeft }) => ({
        orderNo: order.docNo,
        customer: order.customerId,
        productName: order.lines[0]?.productName ?? '',
        dueDate: due.toISOString().slice(0, 10),
        daysLeft,
        stage: order.status === 'EXECUTING' ? '生产中' : '待开工',
        level: daysLeft < 0 ? ('late' as const) : ('due' as const),
        owner: order.createdBy ?? '',
        action: daysLeft < 0 ? '已超期，需立即跟进' : '临期，确认排产与齐套',
      }))
      .sort((left, right) => left.daysLeft - right.daysLeft)
  }

  private async backlogByDimension(keyOf: (order: SalesOrderRecord) => string): Promise<BacklogDimRow[]> {
    const orders = (await this.load()).filter(isBacklog)

    return groupWithShares(orders, keyOf, orderAmountMinor).map((group) => ({
      name: group.key,
      orders: group.items.length,
      amount: toTenThousand(group.amountMinor),
      share: group.share,
      nearestDue: nearestDueLabel(group.items),
    }))
  }
}

function nearestDueLabel(orders: readonly SalesOrderRecord[]): string {
  const dates = orders.map(earliestDueOf).filter((date): date is Date => date !== null)
  if (dates.length === 0) return '—'
  const nearest = dates.reduce((earliest, date) => (date < earliest ? date : earliest))
  return nearest.toISOString().slice(0, 10)
}

/** 增长率；上期缺失或为 0 时返回 0——「无从比较」在这张表里就是不显示涨跌。 */
function growth(current: number, previous: number | null): number {
  if (previous === null || previous === 0) return 0
  return Math.round(((current - previous) / previous) * 1000) / 1000
}

function shiftYear(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-')
  return `${Number(year) + delta}-${month}`
}
