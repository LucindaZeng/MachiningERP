import { PENDING_SOURCES, markPending } from '@machining-erp/shared'
import { Injectable } from '@nestjs/common'

import { SalesOrderService } from '../../contract-order'
import { ORDER_TYPE_LABEL } from '../constants/analytics-labels'
import { ANALYTICS_LIMITS, RANK_LIMIT, TREND_WINDOW_MONTHS } from '../constants/analytics-periods'

import {
  groupBy,
  groupWithShares,
  monthKeyOf,
  rateOf,
  toTenThousand,
} from './analytics-aggregation.rules'
import { CustomerAnalyticsService } from './customer-analytics.service'
import { orderAmountMinor } from './daily-ops.service'
import { DeliveryAnalyticsService } from './delivery-analytics.service'
import { QuoteAnalyticsService } from './quote-analytics.service'

import type { SalesAnalytics } from '@machining-erp/shared'

/**
 * 经营分析看板首屏（规格第 11 章）。
 *
 * `headline` 里的毛利率与毛利目标**留空字符串**而不是 '0%'：
 * 首屏最大那几个数字最容易被当成结论，写 0% 等于告诉老板这个月白干了。
 */
@Injectable()
export class AnalyticsOverviewService {
  constructor(
    private readonly orders: SalesOrderService,
    private readonly customers: CustomerAnalyticsService,
    private readonly delivery: DeliveryAnalyticsService,
    private readonly quotes: QuoteAnalyticsService,
  ) {}

  async overview(asOf: Date): Promise<SalesAnalytics> {
    const orders = (await this.orders.list({ limit: ANALYTICS_LIMITS.ORDERS })).filter(
      (order) => order.approvedAt !== null,
    )

    const thisYear = orders.filter((order) => (order.approvedAt as Date).getFullYear() === asOf.getFullYear())
    const lastYear = orders.filter(
      (order) => (order.approvedAt as Date).getFullYear() === asOf.getFullYear() - 1,
    )
    const ytdMinor = thisYear.reduce((sum, order) => sum + orderAmountMinor(order), 0n)
    const lastYtdMinor = lastYear.reduce((sum, order) => sum + orderAmountMinor(order), 0n)

    const [ranking, onTime, funnel] = await Promise.all([
      this.customers.ranking(),
      this.delivery.onTimeByCustomer(),
      this.quotes.funnel(),
    ])

    const judged = onTime.reduce((total, row) => total + row.total, 0)
    const late = onTime.reduce((total, row) => total + row.late, 0)

    return {
      headline: {
        ytdAmount: `${toTenThousand(ytdMinor)}`,
        ytdGrowth: formatPercent(growthOf(ytdMinor, lastYtdMinor)),
        // 实际毛利要成本模块；空串比 '0%' 诚实
        marginRate: '',
        marginTarget: '',
        onTimeRate: formatPercent(rateOf(judged - late, judged)),
        // 逾期应收在财务侧
        overdueAr: '',
      },
      trend: buildTrend(orders, asOf),
      topCustomers: ranking.slice(0, RANK_LIMIT).map((row) => ({
        label: row.customer,
        value: row.amount,
        hint: `占比 ${Math.round(row.share * 1000) / 10}%`,
      })),
      orderMix: buildMix(orders),
      funnel: funnel.map((row) => ({ label: row.stage, value: row.count, hint: row.hint })),
      // 毛利对比表整张依赖实际成本
      margins: [],
      pending: markPending([
        { key: 'margins', rows: [], source: PENDING_SOURCES.COSTING },
        { key: 'headline.marginRate', rows: [], source: PENDING_SOURCES.COSTING },
        { key: 'headline.overdueAr', rows: [], source: PENDING_SOURCES.FINANCE },
      ]),
    }
  }
}

function buildTrend(orders: readonly { approvedAt: Date | null; lines: unknown[] }[], asOf: Date) {
  const months: string[] = []
  for (let offset = TREND_WINDOW_MONTHS - 1; offset >= 0; offset -= 1) {
    months.push(monthKeyOf(new Date(asOf.getFullYear(), asOf.getMonth() - offset, 1)))
  }

  const byMonth = groupBy(
    orders.filter((order) => order.approvedAt !== null),
    (order) => monthKeyOf(order.approvedAt as Date),
  )

  return months.map((label) => {
    const items = (byMonth.get(label) ?? []) as Array<Parameters<typeof orderAmountMinor>[0]>
    return {
      label,
      amount: toTenThousand(items.reduce((sum, order) => sum + orderAmountMinor(order), 0n)),
      orders: items.length,
    }
  })
}

function buildMix(orders: readonly Parameters<typeof orderAmountMinor>[0][]) {
  return groupWithShares(orders, (order) => String(order.orderType), orderAmountMinor).map(
    (group) => ({
      key: group.key,
      label: ORDER_TYPE_LABEL[group.key as keyof typeof ORDER_TYPE_LABEL] ?? group.key,
      value: group.share,
    }),
  )
}

function growthOf(current: bigint, previous: bigint): number | null {
  if (previous <= 0n) return null
  return Number(current - previous) / Number(previous)
}

/** 空值显示为空串——**不是 '0%'**。看板上的 0% 会被当成真实业绩。 */
function formatPercent(value: number | null): string {
  if (value === null) return ''
  return `${Math.round(value * 1000) / 10}%`
}
