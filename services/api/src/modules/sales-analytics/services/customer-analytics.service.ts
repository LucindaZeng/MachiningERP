import { Injectable } from '@nestjs/common'

import { SalesOrderService } from '../../contract-order'
import { InvoiceRequestService } from '../../invoice-request'
import { ShipmentService } from '../../shipment'
import { churnRiskOf, gradeOf } from '../constants/analytics-labels'
import { ANALYTICS_LIMITS, RANK_LIMIT } from '../constants/analytics-periods'

import {
  averageOf,
  daysBetween,
  groupBy,
  groupWithShares,
  toTenThousand,
} from './analytics-aggregation.rules'
import { orderAmountMinor } from './daily-ops.service'

import type { SalesOrderRecord } from '../../contract-order'
import type {
  ChurnRow,
  CustomerActivityRow,
  CustomerRankRow,
  InvoiceReceivableRow,
  NewCustomerRow,
} from '@machining-erp/shared'

/** 一个客户的下单轨迹——排名、活跃度、流失预警都从这一份事实推。 */
interface CustomerHistory {
  customerId: string
  orders: SalesOrderRecord[]
  amountMinor: bigint
  firstAt: Date | null
  lastAt: Date | null
}

/**
 * 客户维度分析（规格第 11 章）。
 *
 * 客户标识一律用 `customerId` 原样透出，不在这里翻成客户名：
 * 名称属于 masterdata，分析层跨模块逐个查名会把一次聚合变成 N 次往返；
 * 前端已有客户档案缓存，由它显示名字。
 */
@Injectable()
export class CustomerAnalyticsService {
  constructor(
    private readonly orders: SalesOrderService,
    private readonly shipments: ShipmentService,
    private readonly invoices: InvoiceRequestService,
  ) {}

  private async histories(): Promise<CustomerHistory[]> {
    const orders = (await this.orders.list({ limit: ANALYTICS_LIMITS.ORDERS })).filter(
      (order) => order.approvedAt !== null,
    )

    return [...groupBy(orders, (order) => order.customerId)].map(([customerId, items]) => {
      const dates = items.map((item) => item.approvedAt as Date).sort((a, b) => a.getTime() - b.getTime())
      return {
        customerId,
        orders: items,
        amountMinor: items.reduce((sum, item) => sum + orderAmountMinor(item), 0n),
        firstAt: dates[0] ?? null,
        lastAt: dates[dates.length - 1] ?? null,
      }
    })
  }

  /** 客户贡献排行 + 帕累托分级。 */
  async ranking(): Promise<CustomerRankRow[]> {
    const histories = await this.histories()
    const ranked = groupWithShares(
      histories,
      (history) => history.customerId,
      (history) => history.amountMinor,
    ).sort((left, right) => Number(right.amountMinor - left.amountMinor))

    let cumulative = 0
    return ranked.slice(0, RANK_LIMIT).map((group) => {
      cumulative += group.share
      return {
        customer: group.key,
        amount: toTenThousand(group.amountMinor),
        share: group.share,
        cumShare: Math.round(cumulative * 1000) / 1000,
        grade: gradeOf(cumulative),
      }
    })
  }

  /** 客户活跃度：多久没下单、下单频次的变化。 */
  async activity(asOf: Date): Promise<CustomerActivityRow[]> {
    const histories = await this.histories()

    return histories
      .map((history) => {
        const daysSince = daysBetween(history.lastAt, asOf) ?? 0
        return {
          customer: history.customerId,
          lastOrderAt: history.lastAt ? history.lastAt.toISOString().slice(0, 10) : '—',
          daysSince,
          freqChange: frequencyChange(history),
          risk: churnRiskOf(daysSince),
        }
      })
      .sort((left, right) => right.daysSince - left.daysSince)
  }

  /** 流失预警：只列观察与流失两档，正常客户不占版面。 */
  async churn(asOf: Date): Promise<ChurnRow[]> {
    const histories = await this.histories()

    return histories
      .map((history) => {
        const daysSince = daysBetween(history.lastAt, asOf) ?? 0
        const risk = churnRiskOf(daysSince)
        return { history, daysSince, risk }
      })
      .filter((item) => item.risk !== 'normal')
      .map(({ history, daysSince, risk }) => ({
        customer: history.customerId,
        grade: gradeOf(0),
        lastOrderAt: history.lastAt ? history.lastAt.toISOString().slice(0, 10) : '—',
        daysSince,
        avgIntervalDays: averageIntervalDays(history) ?? 0,
        amountChange: frequencyChange(history),
        level: risk === 'churn' ? ('churn' as const) : ('watch' as const),
        owner: history.orders[0]?.createdBy ?? '',
        // 跟进记录属于 CRM 行为，系统里还没有这张表——如实留空，不编
        followedAt: '—',
        followResult: '—',
        nextAction: risk === 'churn' ? '安排回访，确认是否流失' : '关注下单节奏',
      }))
      .sort((left, right) => right.daysSince - left.daysSince)
  }

  /** 新客户：首次下单落在窗口内的客户。 */
  async newCustomers(since: Date): Promise<NewCustomerRow[]> {
    const histories = await this.histories()

    return histories
      .filter((history) => history.firstAt !== null && history.firstAt >= since)
      .map((history) => ({
        customer: history.customerId,
        firstOrderAt: (history.firstAt as Date).toISOString().slice(0, 10),
        firstAmount: toTenThousand(orderAmountMinor(history.orders[0] as SalesOrderRecord)),
        // 客户来源属于 CRM 字段，档案里没有，不猜
        source: '—',
      }))
      .sort((left, right) => right.firstOrderAt.localeCompare(left.firstOrderAt))
  }

  /**
   * 已出货 / 已开票 / 已回款的三段勾稽。
   *
   * `received` 恒为 false 并非「都没回款」——回款事实在财务模块，业务侧看不到。
   * 因此这张表由调用方标 `pending`，界面上说明这一列待财务上线。
   */
  async invoiceReceivable(asOf: Date): Promise<InvoiceReceivableRow[]> {
    const [shipments, invoices] = await Promise.all([
      this.shipments.list({ limit: ANALYTICS_LIMITS.SHIPMENTS }),
      this.invoices.list({ limit: ANALYTICS_LIMITS.INVOICES }),
    ])
    const invoicedShipments = new Set(
      invoices.flatMap((invoice) => invoice.lines.map((line) => line.shipmentId)),
    )

    return shipments
      .filter((shipment) => shipment.shippedAt !== null && shipment.replacesReturnId === null)
      .map((shipment) => ({
        docNo: shipment.docNo,
        customer: shipment.customerId,
        shippedAt: (shipment.shippedAt as Date).toISOString().slice(0, 10),
        amount: toTenThousand(
          shipment.lines.reduce(
            (sum, line) => sum + BigInt(Math.round(Number(line.shippedQty) * Number(line.unitPriceMinor))),
            0n,
          ),
        ),
        invoiced: invoicedShipments.has(shipment.id),
        received: false,
        ageDays: daysBetween(shipment.shippedAt, asOf) ?? 0,
      }))
      .sort((left, right) => right.ageDays - left.ageDays)
  }
}

/** 平均下单间隔（天）。只下过一次单时无间隔可言，返回 null。 */
export function averageIntervalDays(history: CustomerHistory): number | null {
  const dates = history.orders
    .map((order) => order.approvedAt)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime())
  if (dates.length < 2) return null

  const gaps: number[] = []
  for (let index = 1; index < dates.length; index += 1) {
    gaps.push((dates[index]!.getTime() - dates[index - 1]!.getTime()) / 86_400_000)
  }
  return averageOf(gaps)
}

/**
 * 下单频次变化：后半段与前半段的对比。
 * 单据太少（< 4 张）时不给结论——两三张单算不出趋势，只会制造噪音。
 */
export function frequencyChange(history: CustomerHistory): number {
  const dates = history.orders
    .map((order) => order.approvedAt)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime())
  if (dates.length < 4) return 0

  const middle = Math.floor(dates.length / 2)
  const earlier = middle
  const later = dates.length - middle
  return Math.round(((later - earlier) / earlier) * 1000) / 1000
}
