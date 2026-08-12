import { Injectable } from '@nestjs/common'

import { DOC_TYPES } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { SalesOrderService } from '../../contract-order'
import { SalesReturnService } from '../../sales-return'
import { ANALYTICS_LIMITS } from '../constants/analytics-periods'

import { averageOf, groupBy, rateOf } from './analytics-aggregation.rules'
import { ORDER_APPROVAL_SLA_HOURS } from './quote-analytics.service'


import type { TimelineNodeRecord } from '../../../platform/timeline'
import type { ApprovalEfficiency, SlaNodeRow, StockApprovalRow } from '@machining-erp/shared'

/** 单据类型 → 中文名，报表里显示的是这个。 */
const DOC_LABEL: Record<string, string> = {
  [DOC_TYPES.SALES_ORDER]: '销售订单',
  [DOC_TYPES.SALES_RETURN]: '退货单',
}

/** 各节点的目标时长（小时）。超过即计入超期率。 */
const NODE_SLA_HOURS = 24

/**
 * 审核时效（规格第 11 章）。
 *
 * 耗时一律取平台算好的 `durationMs`，**不自己减时间戳**——
 * 两处各算一次迟早会算出两个答案（timeline mapper 里同样的告诫）。
 *
 * ⚠️ 已知代价：`DocTimelineService` 只有 `list(docType, docId)`，
 * 没有批量或按区间的查询，因此这里是 N+1。单据量级到千级以上时，
 * 正确的解法是给 timeline 补一个区间查询，而不是在分析层缓存——
 * 缓存会让「节点耗时」这种要准的数字变得不准。
 */
@Injectable()
export class SlaAnalyticsService {
  constructor(
    private readonly timeline: DocTimelineService,
    private readonly orders: SalesOrderService,
    private readonly returns: SalesReturnService,
  ) {}

  /** 各单据各节点的平均 / P90 耗时与超期率。 */
  async nodeSla(): Promise<SlaNodeRow[]> {
    const nodes = await this.collectNodes()

    return [...groupBy(nodes, (node) => `${node.docType}|${node.node}`)]
      .map(([key, items]) => {
        const [docType, node] = key.split('|')
        const hours = items
          .map((item) => (item.durationMs === null ? null : Number(item.durationMs) / 3_600_000))
          .filter((value): value is number => value !== null)
        const overdue = hours.filter((value) => value > NODE_SLA_HOURS)

        return {
          doc: DOC_LABEL[docType ?? ''] ?? docType ?? '',
          node: node ?? '',
          owner: items[0]?.ownerDept ?? '—',
          avgHours: averageOf(hours) ?? 0,
          p90Hours: percentile(hours, 0.9),
          slaHours: NODE_SLA_HOURS,
          overdueRate: rateOf(overdue.length, hours.length) ?? 0,
        }
      })
      .filter((row) => row.avgHours > 0)
      .sort((left, right) => right.overdueRate - left.overdueRate)
  }

  /** 备料订单的总经办审批时效。 */
  async stockApprovals(): Promise<StockApprovalRow[]> {
    const orders = await this.orders.list({
      orderType: 'STOCK_PREP',
      limit: ANALYTICS_LIMITS.ORDERS,
    })

    return orders
      .filter((order) => order.submittedAt !== null && order.approvedAt !== null)
      .map((order) => {
        const hours =
          Math.round(
            (((order.approvedAt as Date).getTime() - (order.submittedAt as Date).getTime()) /
              3_600_000) *
              10,
          ) / 10
        return {
          docNo: order.docNo,
          productName: order.lines[0]?.productName ?? '',
          qty: order.lines.reduce((total, line) => total + Number(line.quantity), 0),
          amount: Number(order.estimatedCostMinor ?? 0n) / 1_000_000,
          submittedAt: (order.submittedAt as Date).toISOString().slice(0, 16).replace('T', ' '),
          approvedAt: (order.approvedAt as Date).toISOString().slice(0, 16).replace('T', ' '),
          hours,
          slaHours: ORDER_APPROVAL_SLA_HOURS,
          // 订单头上没有 approvedBy，只有 approvedAt——如实留空而不是编一个人名
          approver: '—',
        }
      })
      .sort((left, right) => right.hours - left.hours)
  }

  /** 工作台的审批效率卡。 */
  async approvalEfficiency(): Promise<ApprovalEfficiency[]> {
    const rows = await this.nodeSla()

    return rows.map((row) => ({
      node: `${row.doc} · ${row.node}`,
      median: `${row.avgHours} 小时`,
      p90: `${row.p90Hours} 小时`,
      onTimeRate: Math.round((1 - row.overdueRate) * 1000) / 1000,
      // 退回率要区分「退回」与「正常推进」两类迁移，timeline 上没有这个语义
      returnRate: 0,
      backlog: 0,
    }))
  }

  /** 两类单据的节点记录。逐单取——timeline 没有批量查询。 */
  private async collectNodes(): Promise<TimelineNodeRecord[]> {
    const [orders, returns] = await Promise.all([
      this.orders.list({ limit: ANALYTICS_LIMITS.ORDERS }),
      this.returns.list({ limit: ANALYTICS_LIMITS.RETURNS }),
    ])

    const batches = await Promise.all([
      ...orders.map((order) => this.timeline.list(DOC_TYPES.SALES_ORDER, order.id)),
      ...returns.map((record) => this.timeline.list(DOC_TYPES.SALES_RETURN, record.id)),
    ])

    return batches.flat()
  }
}

/** P90。空集返回 0——调用方已经用 `avgHours > 0` 过滤掉了无数据的节点。 */
export function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))
  return Math.round((sorted[index] ?? 0) * 10) / 10
}
