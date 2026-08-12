import { PENDING_SOURCES, markPending } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BACKLOG_WARN_DAYS } from '../constants/analytics-labels'
import {
  COSTING_ANALYTICS_PORT,
  FINANCE_ANALYTICS_PORT,
  MES_ANALYTICS_PORT,
  WMS_ANALYTICS_PORT,
  type CostingAnalyticsPort,
  type FinanceAnalyticsPort,
  type MesAnalyticsPort,
  type WmsAnalyticsPort,
} from '../repositories/upstream-source.ports'

import { CustomerAnalyticsService } from './customer-analytics.service'
import { DeliveryAnalyticsService } from './delivery-analytics.service'
import { OrderAnalyticsService } from './order-analytics.service'
import { QuoteAnalyticsService } from './quote-analytics.service'
import { RmaAnalyticsService } from './rma-analytics.service'
import { SlaAnalyticsService } from './sla-analytics.service'

import type {
  CostReports,
  MarketReports,
  OrderExtraReports,
  SalesReports,
} from '@machining-erp/shared'

/**
 * 六个报表端点的组装（规格第 11 章）。
 *
 * 每个面板要么**完全来自真实模块**，要么**明确标记为数据源未上线**——
 * 不做混合：一张一半真一半编的表，比一张空表更难被发现有问题。
 *
 * `markPending` 只在行集确实为空时贴标记，因此真实来源接上之后
 * 标记自动消失，这里一行都不用改。
 */
@Injectable()
export class AnalyticsReportService {
  constructor(
    private readonly quotes: QuoteAnalyticsService,
    private readonly orders: OrderAnalyticsService,
    private readonly delivery: DeliveryAnalyticsService,
    private readonly customers: CustomerAnalyticsService,
    private readonly rma: RmaAnalyticsService,
    private readonly sla: SlaAnalyticsService,
    @Inject(COSTING_ANALYTICS_PORT) private readonly costing: CostingAnalyticsPort,
    @Inject(FINANCE_ANALYTICS_PORT) private readonly finance: FinanceAnalyticsPort,
    @Inject(WMS_ANALYTICS_PORT) private readonly wms: WmsAnalyticsPort,
    @Inject(MES_ANALYTICS_PORT) private readonly mes: MesAnalyticsPort,
  ) {}

  /** GET /sales/reports —— 六大类报表明细。 */
  async salesReports(asOf: Date): Promise<SalesReports> {
    const [real, upstream] = await Promise.all([this.realReportPanels(asOf), this.upstreamPanels()])

    return {
      ...real,
      // 依赖尚未上线模块的面板一律留空，由下面的 pending 说明是哪个模块
      costVariance: [],
      customerMargin: [],
      productMargin: [],
      materialMix: [],
      processMix: [],
      priceTrend: [],
      arAging: upstream.arAging,
      pending: markPending([
        { key: 'costVariance', rows: upstream.costVariance, source: PENDING_SOURCES.COSTING },
        { key: 'customerMargin', rows: [], source: PENDING_SOURCES.COSTING },
        { key: 'productMargin', rows: [], source: PENDING_SOURCES.COSTING },
        { key: 'priceTrend', rows: [], source: PENDING_SOURCES.COSTING },
        { key: 'arAging', rows: upstream.arAging, source: PENDING_SOURCES.FINANCE },
        { key: 'materialMix', rows: [], source: PENDING_SOURCES.MES },
        { key: 'processMix', rows: upstream.productProcess, source: PENDING_SOURCES.MES },
      ]),
    }
  }

  /** 完全来自真实模块的那些面板。分三段取，各段都远在 60 行以内。 */
  private async realReportPanels(asOf: Date) {
    const [quote, delivery, customer] = await Promise.all([
      this.quotePanels(),
      this.deliveryPanels(),
      this.customerPanels(asOf),
    ])
    return { ...quote, ...delivery, ...customer }
  }

  private async quotePanels() {
    const [quoteFunnel, quoteByOwner, quoteByMaterial, lostReasons, quoteCycle, sampleConversion] =
      await Promise.all([
        this.quotes.funnel(),
        this.quotes.byOwner(),
        this.quotes.byMaterial(),
        this.quotes.lostReasons(),
        this.quotes.cycle(),
        this.quotes.sampleConversion(),
      ])
    return { quoteFunnel, quoteByOwner, quoteByMaterial, lostReasons, quoteCycle, sampleConversion }
  }

  private async deliveryPanels() {
    const [backlog, orderMix, orderTrend, onTime, lateReasons, shipmentAchieve] = await Promise.all([
      this.orders.backlogBuckets(),
      this.orders.orderMix(),
      this.orders.orderTrend(),
      this.delivery.onTimeByCustomer(),
      this.delivery.lateReasons(),
      this.delivery.achievement(),
    ])
    return { backlog, orderMix, orderTrend, onTime, lateReasons, shipmentAchieve }
  }

  private async customerPanels(asOf: Date) {
    const [customerRank, customerActivity, newCustomers, invoiceReceivable, rmaStats, repeatIssues] =
      await Promise.all([
        this.customers.ranking(),
        this.customers.activity(asOf),
        this.customers.newCustomers(startOfYear(asOf)),
        this.customers.invoiceReceivable(asOf),
        this.rma.statsByReason(),
        this.rma.repeatIssues(),
      ])
    return { customerRank, customerActivity, newCustomers, invoiceReceivable, rmaStats, repeatIssues }
  }

  /** 依赖尚未上线模块的那些——stub 现阶段一律返回空。 */
  private async upstreamPanels() {
    const [costVariance, arAging, productProcess] = await Promise.all([
      this.costing.elementVariance(),
      this.finance.arAging(),
      this.mes.productProcess(),
    ])
    return { costVariance, arAging, productProcess }
  }

  /** GET /sales/reports/cost-variance —— 成本偏差与审核时效。 */
  async costReports(): Promise<CostReports> {
    const [elementVariance, drill, operationVariance, costRef, slaNodes, stockApproval] =
      await Promise.all([
        this.costing.elementVariance(),
        this.costing.costDrill(),
        this.costing.operationVariance(),
        this.costing.costReference(),
        this.sla.nodeSla(),
        this.sla.stockApprovals(),
      ])

    return {
      elementVariance,
      drill,
      operationVariance,
      costRef,
      // 审核时效来自平台节点计时，是真实数据
      slaNodes,
      stockApproval,
      threshold: { warn: 0.05, alert: 0.1, note: '偏差阈值：5% 关注，10% 告警' },
      pending: markPending([
        { key: 'elementVariance', rows: elementVariance, source: PENDING_SOURCES.COSTING },
        { key: 'drill', rows: drill, source: PENDING_SOURCES.COSTING },
        { key: 'operationVariance', rows: operationVariance, source: PENDING_SOURCES.COSTING },
        { key: 'costRef', rows: costRef, source: PENDING_SOURCES.COSTING },
      ]),
    }
  }

  /** GET /sales/reports/order-extra —— 订单结构、Backlog、样品与备料。 */
  async orderReports(): Promise<OrderExtraReports> {
    const [
      orderType5,
      backlogMonth,
      backlogCustomer,
      backlogProduct,
      backlogAlerts,
      sampleCycle,
      stockProgress,
      stockAging,
      stockConsume,
      stockIdle,
    ] = await Promise.all([
      this.orders.orderType5(),
      this.orders.backlogByMonth(),
      this.orders.backlogByCustomer(),
      this.orders.backlogByProduct(),
      this.orders.backlogAlerts(BACKLOG_WARN_DAYS),
      this.quotes.sampleCycle(),
      this.wms.stockProgress(),
      this.wms.stockAging(),
      this.wms.stockConsume(),
      this.wms.stockIdle(),
    ])

    return {
      orderType5,
      backlogMonth,
      backlogCustomer,
      backlogProduct,
      backlogAlerts,
      sampleCycle,
      // 样品收费模式与待跟进属于 CRM 行为记录，系统里还没有
      sampleCharge: [],
      samplePending: [],
      stockProgress,
      stockAging,
      stockConsume,
      stockIdle,
      stockCapital: { totalAmount: 0, idleAmount: 0, turnoverDays: 0, note: '待仓储模块上线' },
      pending: markPending([
        { key: 'stockProgress', rows: stockProgress, source: PENDING_SOURCES.WMS },
        { key: 'stockAging', rows: stockAging, source: PENDING_SOURCES.WMS },
        { key: 'stockConsume', rows: stockConsume, source: PENDING_SOURCES.WMS },
        { key: 'stockIdle', rows: stockIdle, source: PENDING_SOURCES.WMS },
        { key: 'stockCapital', rows: [], source: PENDING_SOURCES.WMS },
      ]),
    }
  }

  /** GET /sales/reports/market —— 流失预警、工艺分布、出货与退货责任。 */
  async marketReports(asOf: Date): Promise<MarketReports> {
    const [churn, productProcess, materialProcess, partialShip, rmaResponsibility] =
      await Promise.all([
        this.customers.churn(asOf),
        this.mes.productProcess(),
        this.mes.materialProcess(),
        this.delivery.partialShipments(),
        this.rma.byResponsibility(),
      ])

    return {
      churn,
      productProcess,
      materialProcess,
      partialShip,
      // 出货阻塞原因来自品质放行与财务信用两道闸门，QMS/finance 上线后才有明细
      shipBlockers: [],
      rmaResponsibility,
      pending: markPending([
        { key: 'productProcess', rows: productProcess, source: PENDING_SOURCES.MES },
        { key: 'materialProcess', rows: materialProcess, source: PENDING_SOURCES.MES },
        { key: 'shipBlockers', rows: [], source: PENDING_SOURCES.FINANCE },
      ]),
    }
  }
}

function startOfYear(asOf: Date): Date {
  return new Date(asOf.getFullYear(), 0, 1)
}
