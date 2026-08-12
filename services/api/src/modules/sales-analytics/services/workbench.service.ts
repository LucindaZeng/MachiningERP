import { PENDING_SOURCES, markPending } from '@machining-erp/shared'
import { Injectable } from '@nestjs/common'

import { NotificationService } from '../../../platform/notification'
import { SalesOrderService } from '../../contract-order'
import { InvoiceRequestService } from '../../invoice-request'
import { SalesReturnService } from '../../sales-return'
import { ShipmentService } from '../../shipment'
import { BACKLOG_WARN_DAYS, RMA_RESPONSE_SLA_HOURS } from '../constants/analytics-labels'
import { ANALYTICS_LIMITS } from '../constants/analytics-periods'

import { hoursBetween, toTenThousand } from './analytics-aggregation.rules'
import { orderAmountMinor } from './daily-ops.service'
import { OrderAnalyticsService, isBacklog } from './order-analytics.service'
import { RmaAnalyticsService } from './rma-analytics.service'
import { SlaAnalyticsService } from './sla-analytics.service'

import type { AlertItem, KpiCard, SalesWorkbench, TodoItem } from '@machining-erp/shared'

/**
 * 业务部工作台（规格第 1 章）。
 *
 * 待办**来自单据的真实状态**，不另建待办表：一张「待审核」的订单本身
 * 就是那条待办，另存一份只会两边不一致。
 * 预警走平台通知流（api-conventions「事件是事实来源」），
 * 业务侧同样不建预警表。
 */
@Injectable()
export class WorkbenchService {
  constructor(
    private readonly orders: SalesOrderService,
    private readonly shipments: ShipmentService,
    private readonly returns: SalesReturnService,
    private readonly invoices: InvoiceRequestService,
    private readonly notifications: NotificationService,
    private readonly orderAnalytics: OrderAnalyticsService,
    private readonly rma: RmaAnalyticsService,
    private readonly sla: SlaAnalyticsService,
  ) {}

  async workbench(userCode: string, asOf: Date): Promise<SalesWorkbench> {
    const [kpis, todos, alerts, approvals] = await Promise.all([
      this.kpiCards(asOf),
      this.todos(asOf),
      this.alerts(userCode),
      this.sla.approvalEfficiency(),
    ])

    return {
      kpis,
      todos,
      alerts,
      approvals,
      pending: markPending([
        { key: 'kpis.margin', rows: [], source: PENDING_SOURCES.COSTING },
        { key: 'kpis.receivable', rows: [], source: PENDING_SOURCES.FINANCE },
      ]),
    }
  }

  /** KPI 卡。依赖成本与财务的两张卡不出现——不出现好过给一个 0。 */
  private async kpiCards(asOf: Date): Promise<KpiCard[]> {
    const orders = await this.orders.list({ limit: ANALYTICS_LIMITS.ORDERS })
    const approved = orders.filter((order) => order.approvedAt !== null)
    const thisMonth = approved.filter(
      (order) =>
        (order.approvedAt as Date).getFullYear() === asOf.getFullYear() &&
        (order.approvedAt as Date).getMonth() === asOf.getMonth(),
    )
    const backlog = orders.filter(isBacklog)
    const responseRate = await this.rma.responseRate(RMA_RESPONSE_SLA_HOURS)

    const cards: KpiCard[] = [
      {
        key: 'monthOrders',
        label: '本月接单',
        value: `${toTenThousand(thisMonth.reduce((sum, order) => sum + orderAmountMinor(order), 0n))}`,
        unit: '万元',
        trend: `${thisMonth.length} 张`,
        trendUp: thisMonth.length > 0,
        hint: '按 ORD-02 审核通过日归集',
      },
      {
        key: 'backlog',
        label: '在手订单',
        value: `${toTenThousand(backlog.reduce((sum, order) => sum + orderAmountMinor(order), 0n))}`,
        unit: '万元',
        trend: `${backlog.length} 张`,
        trendUp: false,
        hint: '已评审通过、尚未发清',
      },
    ]

    // 首响达标率只有在真有客诉时才是一个有意义的数字
    if (responseRate !== null) {
      cards.push({
        key: 'rmaResponse',
        label: '客诉首响达标率',
        value: `${Math.round(responseRate * 1000) / 10}`,
        unit: '%',
        trend: `SLA ${RMA_RESPONSE_SLA_HOURS} 小时`,
        trendUp: responseRate >= 0.9,
        hint: '首次响应与转品质判定为同一动作',
      })
    }

    return cards
  }

  /** 待办：逐类单据取「压在业务手上」的那些。 */
  private async todos(asOf: Date): Promise<TodoItem[]> {
    const [orders, shipments, returns, invoices, alerts] = await Promise.all([
      // 「压在业务经理手上」= MANAGER_REVIEW；财务/总经办/跨部门评审属于别的岗位的待办
      this.orders.list({ status: 'MANAGER_REVIEW', limit: ANALYTICS_LIMITS.ORDERS }),
      this.shipments.list({ status: 'PACKED', limit: ANALYTICS_LIMITS.SHIPMENTS }),
      this.returns.list({ status: 'REGISTERED', limit: ANALYTICS_LIMITS.RETURNS }),
      this.invoices.list({ status: 'DRAFT', limit: ANALYTICS_LIMITS.INVOICES }),
      this.orderAnalytics.backlogAlerts(BACKLOG_WARN_DAYS),
    ])

    return [
      ...orders.map((order) => todo('订单待审核', order.docNo, order.customerId, order.submittedAt, asOf, `/sales/orders/${order.id}`)),
      ...shipments.map((item) => todo('待出运', item.docNo, item.customerId, item.packedAt, asOf, `/sales/shipments/${item.id}`)),
      ...returns.map((item) => todo('客诉待响应', item.docNo, item.customerId, item.complaintAt, asOf, `/sales/returns/${item.id}`)),
      ...invoices.map((item) => todo('发票申请草稿', item.docNo, item.customerId, item.submittedAt, asOf, `/sales/invoices/${item.id}`)),
      ...alerts.map((item) => ({
        id: `backlog-${item.orderNo}`,
        category: '交期预警',
        title: `${item.productName} ${item.action}`,
        docNo: item.orderNo,
        customer: item.customer,
        dueAt: item.dueDate,
        level: item.level === 'late' ? ('overdue' as const) : ('due' as const),
        route: '/sales/orders',
      })),
    ]
  }

  /** 预警：平台通知流里当前未读的那些。 */
  private async alerts(userCode: string): Promise<AlertItem[]> {
    const records = await this.notifications.listUnread(userCode)

    return records.map((record) => ({
      id: record.id,
      level: 'info' as const,
      domain: record.category,
      subject: record.title,
      triggerValue: record.body ?? '',
      threshold: '—',
      occurredAt: record.createdAt.toISOString(),
      dueAt: '—',
      owner: record.recipientUserCode,
      escalateTo: '—',
      relatedDocNo: record.docId ?? '—',
      suggestion: record.body ?? '',
    }))
  }
}

/** 一条待办。`dueAt` 缺失时显示 '—'——比显示 1970-01-01 强。 */
function todo(
  category: string,
  docNo: string,
  customer: string,
  since: Date | null,
  asOf: Date,
  route: string,
): TodoItem {
  const waited = hoursBetween(since, asOf)
  return {
    id: `${category}-${docNo}`,
    category,
    title: waited === null ? category : `${category}（已等待 ${waited} 小时）`,
    docNo,
    customer,
    dueAt: since ? since.toISOString().slice(0, 10) : '—',
    level: waited !== null && waited > 24 ? 'overdue' : 'due',
    route,
  }
}
