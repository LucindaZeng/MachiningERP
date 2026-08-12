import { NotificationService } from '../../../platform/notification'
import { DocTimelineService } from '../../../platform/timeline'
import { SalesOrderService } from '../../contract-order'
import { InvoiceRequestService } from '../../invoice-request'
import { SalesReturnService } from '../../sales-return'
import { ShipmentService } from '../../shipment'
import {
  StubCostingAnalyticsAdapter,
  StubFinanceAnalyticsAdapter,
  StubMesAnalyticsAdapter,
  StubWmsAnalyticsAdapter,
} from '../repositories/stub-upstream.adapters'
import { AnalyticsOverviewService } from '../services/analytics-overview.service'
import { AnalyticsReportService } from '../services/analytics-report.service'
import { CustomerAnalyticsService } from '../services/customer-analytics.service'
import { DailyOpsService } from '../services/daily-ops.service'
import { DeliveryAnalyticsService } from '../services/delivery-analytics.service'
import { OrderAnalyticsService } from '../services/order-analytics.service'
import { QuoteAnalyticsService } from '../services/quote-analytics.service'
import { RmaAnalyticsService } from '../services/rma-analytics.service'
import { SlaAnalyticsService } from '../services/sla-analytics.service'
import { WorkbenchService } from '../services/workbench.service'

import type { SalesOrderRecord } from '../../contract-order'
import type { InvoiceRecord } from '../../invoice-request'
import type { SalesReturnRecord } from '../../sales-return'
import type { ShipmentRecord } from '../../shipment'
import type {
  CostingAnalyticsPort,
  FinanceAnalyticsPort,
  MesAnalyticsPort,
  WmsAnalyticsPort,
} from '../repositories/upstream-source.ports'

export const ASOF = new Date(2026, 6, 28, 12, 0, 0)

export interface Sources {
  orders: SalesOrderRecord[]
  shipments: ShipmentRecord[]
  returns: SalesReturnRecord[]
  invoices: InvoiceRecord[]
}

export interface Harness {
  sources: Sources
  overview: AnalyticsOverviewService
  reports: AnalyticsReportService
  dailyOps: DailyOpsService
  workbench: WorkbenchService
  rma: RmaAnalyticsService
  delivery: DeliveryAnalyticsService
  orders: OrderAnalyticsService
  customers: CustomerAnalyticsService
  quotes: QuoteAnalyticsService
  sla: SlaAnalyticsService
}

/**
 * 一套假件搭起整条分析链路。
 *
 * 四个上游 stub 默认用**真实的 stub 实现**而不是 jest mock——
 * 「空行集 + pending 标记」这条约定正是 stub 本身的语义，
 * 换成 mock 就等于把要测的东西替换掉了。
 */
export function buildHarness(
  sources: Partial<Sources> = {},
  upstream: Partial<{
    costing: CostingAnalyticsPort
    finance: FinanceAnalyticsPort
    wms: WmsAnalyticsPort
    mes: MesAnalyticsPort
  }> = {},
): Harness {
  const data: Sources = {
    orders: sources.orders ?? [],
    shipments: sources.shipments ?? [],
    returns: sources.returns ?? [],
    invoices: sources.invoices ?? [],
  }

  const orderService = {
    list: jest.fn(async (query: { status?: string; orderType?: string }) =>
      data.orders
        .filter((order) => !query.status || order.status === query.status)
        .filter((order) => !query.orderType || order.orderType === query.orderType),
    ),
  } as unknown as SalesOrderService
  const shipmentService = {
    list: jest.fn(async (query: { status?: string }) =>
      data.shipments.filter((item) => !query.status || item.status === query.status),
    ),
  } as unknown as ShipmentService
  const returnService = {
    list: jest.fn(async (query: { status?: string }) =>
      data.returns.filter((item) => !query.status || item.status === query.status),
    ),
  } as unknown as SalesReturnService
  const invoiceService = {
    list: jest.fn(async (query: { status?: string }) =>
      data.invoices.filter((item) => !query.status || item.status === query.status),
    ),
  } as unknown as InvoiceRequestService
  const timeline = { list: jest.fn(async () => []) } as unknown as DocTimelineService
  const notifications = { listUnread: jest.fn(async () => []) } as unknown as NotificationService

  const costing = upstream.costing ?? new StubCostingAnalyticsAdapter()
  const finance = upstream.finance ?? new StubFinanceAnalyticsAdapter()
  const wms = upstream.wms ?? new StubWmsAnalyticsAdapter()
  const mes = upstream.mes ?? new StubMesAnalyticsAdapter()

  const quotes = new QuoteAnalyticsService(orderService)
  const orders = new OrderAnalyticsService(orderService)
  const delivery = new DeliveryAnalyticsService(orderService, shipmentService)
  const customers = new CustomerAnalyticsService(orderService, shipmentService, invoiceService)
  const rma = new RmaAnalyticsService(returnService)
  const sla = new SlaAnalyticsService(timeline, orderService, returnService)
  const dailyOps = new DailyOpsService(orderService, shipmentService)
  const overview = new AnalyticsOverviewService(orderService, customers, delivery, quotes)
  const reports = new AnalyticsReportService(
    quotes,
    orders,
    delivery,
    customers,
    rma,
    sla,
    costing,
    finance,
    wms,
    mes,
  )
  const workbench = new WorkbenchService(
    orderService,
    shipmentService,
    returnService,
    invoiceService,
    notifications,
    orders,
    rma,
    sla,
  )

  return { sources: data, overview, reports, dailyOps, workbench, rma, delivery, orders, customers, quotes, sla }
}

/** 一张已批准的订单。金额 = 数量 × 单价，逐行算。 */
export function order(overrides: Partial<SalesOrderRecord> = {}): SalesOrderRecord {
  return {
    id: 'O1',
    docNo: 'SO-20260710-0085',
    customerId: 'C1',
    orderType: 'FORMAL',
    chargeMode: 'CHARGED',
    customerPoNo: null,
    customerPoFile: null,
    currency: 'CNY',
    taxRateBps: 1300,
    internalDueDate: null,
    costOwner: null,
    freeReason: null,
    estimatedCostMinor: null,
    status: 'APPROVED',
    submittedAt: new Date(2026, 6, 9, 9, 0),
    submittedBy: 'WFX-2018-0042',
    approvedAt: new Date(2026, 6, 10, 9, 0),
    rejectReason: null,
    stockedQty: null,
    stockStatus: null,
    createdBy: 'WFX-2018-0042',
    versionLock: 0,
    lines: [
      {
        id: 'OL1',
        sequence: 1,
        quotationId: 'Q1',
        quotationItemId: 'QI1',
        costAnalysisId: null,
        productName: '铝合金探头支架',
        drawingNo: 'MT-9001',
        drawingVersionId: null,
        revision: null,
        itemCode: null,
        bomRequestNo: null,
        quantity: '100.000000',
        unitPriceMinor: 2_490n,
        deliveryDate: new Date(2026, 6, 25),
        remark: null,
      },
    ],
    ...overrides,
  } as SalesOrderRecord
}

/** 一张已发出的出货单。 */
export function shipment(overrides: Partial<ShipmentRecord> = {}): ShipmentRecord {
  return {
    id: 'SH1',
    docNo: 'SHP-20260727-0064',
    orderId: 'O1',
    customerId: 'C1',
    deliveryAddressId: null,
    replacesReturnId: null,
    currency: 'CNY',
    carrier: null,
    trackingNo: null,
    invoiceNo: null,
    status: 'SHIPPED',
    ownerUserCode: 'WFX-2018-0042',
    packedAt: new Date(2026, 6, 20, 8, 0),
    shippedAt: new Date(2026, 6, 20, 12, 0),
    signedAt: null,
    invoicedAt: null,
    closedAt: null,
    versionLock: 0,
    lines: [
      {
        id: 'SL1',
        sequence: 1,
        orderLineId: 'OL1',
        productName: '铝合金探头支架',
        drawingNo: 'MT-9001',
        itemCode: null,
        batchNo: 'B1',
        orderedQty: '100.000000',
        qualifiedQty: '100.000000',
        packedQty: '100.000000',
        shippedQty: '100.000000',
        unitPriceMinor: 2_490n,
        tailPlan: null,
        tailResolvedQty: '0.000000',
        tailApprovedBy: null,
        tailApprovedAt: null,
        tailRemark: null,
      },
    ],
    ...overrides,
  } as ShipmentRecord
}

/** 一张已结案的退货单，逐行带责任与处置。 */
export function salesReturn(overrides: Partial<SalesReturnRecord> = {}): SalesReturnRecord {
  return {
    id: 'RMA1',
    docNo: 'RMA-20260726-0009',
    orderId: 'O1',
    shipmentId: 'SH1',
    customerId: 'C1',
    currency: 'CNY',
    reason: '孔位尺寸超差',
    eightDNo: null,
    eightDRequired: false,
    status: 'CLOSED',
    ownerUserCode: 'WFX-2018-0042',
    complaintAt: new Date(2026, 6, 26, 9, 0),
    respondedAt: new Date(2026, 6, 26, 10, 0),
    judgedAt: null,
    judgedBy: null,
    approvedAt: null,
    approvedBy: null,
    closedAt: new Date(2026, 6, 27, 9, 0),
    needFinanceApproval: false,
    rejectReason: null,
    versionLock: 0,
    lines: [
      {
        id: 'RL1',
        sequence: 1,
        shipmentLineId: 'SL1',
        orderLineId: 'OL1',
        productName: '铝合金探头支架',
        drawingNo: 'MT-9001',
        batchNo: 'B1',
        returnQty: '10.000000',
        unitPriceMinor: 2_490n,
        amountMinor: 24_900n,
        reason: '平面度超差',
        responsibility: 'COMPANY',
        disposition: 'REFUND',
        dispositionNote: '全额退款',
        allowanceMinor: null,
        receivedAt: null,
        receivedQty: null,
        settledByCreditNote: false,
        creditNoteDocNo: null,
      },
    ],
    ...overrides,
  } as SalesReturnRecord
}
