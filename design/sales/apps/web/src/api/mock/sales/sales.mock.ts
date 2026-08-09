import { BizError } from '../../biz-error'
import { COST_ANALYSES, QUOTATIONS } from './quotation.fixture'
import { HISTORICAL_QUOTES } from './historical-quote.fixture'
import { QUOTE_CHANGES } from './quote-change.fixture'
import { CUSTOMERS } from './customer.fixture'
import { CUSTOMS_DOSSIERS, SALES_RETURNS, SHIPMENTS } from './fulfilment.fixture'
import { SALES_ORDERS } from './sales-order.fixture'
import { ORDER_TRACKINGS } from './order-tracking.fixture'
import { STATEMENTS } from './statement.fixture'
import { INVOICE_REQUESTS } from './invoice.fixture'
import { STOCK_ORDERS } from './stock-order.fixture'
import { SALES_ANALYTICS } from './analytics.fixture'
import { DAILY_OPS } from './daily-ops.fixture'
import { SALES_REPORTS } from './analytics-reports.fixture'
import { COST_REPORTS } from './analytics-cost.fixture'
import { ORDER_EXTRA_REPORTS } from './analytics-order.fixture'
import { MARKET_REPORTS } from './analytics-market.fixture'
import { BOM_REQUESTS } from './bom-request.fixture'
import { ENGINEERING_CHANGES } from './ecn.fixture'
import { ORDER_CHANGES } from './order-change.fixture'
import { MATERIAL_PRICES } from './material-price.fixture'
import { ALERTS, APPROVAL_EFFICIENCY, KPI_CARDS, TODOS } from './workbench.fixture'
import type { HkPricing, OrderType, SalesOrder } from '@/types/sales.types'

type Handler = (body: unknown) => unknown

interface HkCalculateInput {
  customerCode: string
  orderType: OrderType
  originalUnitPrice: string
  quantity: string
}

let orderSequence = SALES_ORDERS.length

/** 业务部 mock 路由表：键为 `METHOD 路径`，与 docs/api/api-reference.md 对齐。 */
const HANDLERS: Record<string, Handler> = {
  'GET /sales/workbench': () => ({
    kpis: KPI_CARDS,
    todos: TODOS,
    alerts: ALERTS,
    approvals: APPROVAL_EFFICIENCY,
  }),
  'GET /sales/analytics': () => SALES_ANALYTICS,
  'GET /sales/reports/daily-ops': () => DAILY_OPS,
  'GET /sales/reports': () => SALES_REPORTS,
  'GET /sales/reports/cost-variance': () => COST_REPORTS,
  'GET /sales/reports/order-extra': () => ORDER_EXTRA_REPORTS,
  'GET /sales/reports/market': () => MARKET_REPORTS,
  'GET /quotations': () => QUOTATIONS,
  'GET /quotations/cost-analyses': () => COST_ANALYSES,
  'GET /quotations/history': () => HISTORICAL_QUOTES,
  'GET /quotations/change-requests': () => QUOTE_CHANGES,
  'GET /customers': () => CUSTOMERS,
  'GET /metal-prices/board': () => MATERIAL_PRICES,
  'GET /bom-requests': () => BOM_REQUESTS,
  'GET /engineering-changes': () => ENGINEERING_CHANGES,
  'GET /order-changes': () => ORDER_CHANGES,
  'GET /sales-orders': () => SALES_ORDERS,
  'GET /stock-orders': () => STOCK_ORDERS,
  'GET /order-trackings': () => ORDER_TRACKINGS,
  'GET /statements/customer': () => STATEMENTS,
  'GET /invoice-requests': () => INVOICE_REQUESTS,
  'GET /shipments': () => SHIPMENTS,
  'GET /sales-returns': () => SALES_RETURNS,
  'GET /customs-dossiers': () => CUSTOMS_DOSSIERS,
  'POST /hk-pricing/calculate': (body) => calculateHkPricing(body as HkCalculateInput),
  'POST /sales-orders': (body) => createSalesOrder(body as Record<string, string>),
  'POST /shipments/tail-plan': (body) => applyTailPlan(body as { docNo: string; plan: string }),
  'POST /documents/render': (body) => renderDocument(body as { templateCode: string }),
}

export function dispatchSalesMock(route: string, body: unknown): { handled: boolean; data?: unknown } {
  const handler = HANDLERS[route]
  return handler ? { handled: true, data: handler(body) } : { handled: false }
}

/**
 * HK 70% 试算：触发条件 = 客户勾选「香港代生产价格客户」且订单类型为正式业务订单。
 * 同时做防重复折算校验（原价 × 系数 = 计算价，否则拒绝）。
 */
export function calculateHkPricing(input: HkCalculateInput): HkPricing {
  const customer = CUSTOMERS.find((item) => item.code === input.customerCode)
  const flagged = Boolean(customer?.hkPricingEnabled)
  const applied = flagged && input.orderType === 'formal'
  const factor = applied ? (customer?.hkFactor ?? 0.7) : 1
  const original = Number(input.originalUnitPrice || '0')

  if (Number.isNaN(original)) {
    throw new BizError({ code: 'ORD_2501', message: '原始单价格式不正确', status: 422 })
  }

  return {
    applied,
    factor,
    originalUnitPrice: original.toFixed(2),
    finalUnitPrice: (original * factor).toFixed(2),
    roundingRule: '四舍五入保留 2 位',
    calculatedAt: '2026-07-28 17:30',
    priceVersion: `PV-${(orderSequence + 1).toString().padStart(4, '0')}`,
    customerFlagSnapshot: flagged,
    orderTypeSnapshot: input.orderType,
  }
}

function createSalesOrder(body: Record<string, string>): SalesOrder {
  assertOrderRules(body)

  orderSequence += 1
  const hk = calculateHkPricing({
    customerCode: body.customerCode,
    orderType: body.orderType as OrderType,
    originalUnitPrice: body.originalUnitPrice,
    quantity: body.quantity,
  })

  const customer = CUSTOMERS.find((item) => item.code === body.customerCode)
  const amount = (Number(hk.finalUnitPrice) * Number(body.quantity || '0')).toFixed(2)

  const order: SalesOrder = {
    id: `SO-NEW-${orderSequence}`,
    docNo: `SO-20260728-0${(118 + orderSequence).toString()}`,
    customerCode: body.customerCode,
    customerName: customer?.shortName ?? body.customerCode,
    orderType: body.orderType as OrderType,
    chargeMode: body.chargeMode as SalesOrder['chargeMode'],
    productName: body.productName,
    drawingNo: body.drawingNo,
    quantity: body.quantity,
    currency: body.currency || 'CNY',
    taxRate: Number(body.taxRate || '0'),
    unitPrice: hk.finalUnitPrice,
    amount,
    deliveryDate: body.deliveryDate,
    quotationNo: body.quotationNo,
    customerPoNo: body.customerPoNo,
    costOwner: body.costOwner,
    freeReason: body.freeReason,
    estimatedCost: body.estimatedCost,
    status: 'submitted',
    owner: '罗晓琳',
    t0: '2026-07-28 17:30',
    reviewRounds: 0,
    hk,
    timeline: [
      {
        node: 'ORD-01 业务建单提交（T0）',
        owner: '罗晓琳',
        state: 'done',
        enteredAt: '2026-07-28 17:10',
        finishedAt: '2026-07-28 17:30',
        elapsedHours: 0.3,
      },
      {
        node: 'ORD-02 业务经理审核',
        owner: '周敏',
        state: 'active',
        enteredAt: '2026-07-28 17:30',
        dueAt: '2026-07-29 17:30',
      },
      { node: 'ORD-03 财务审核', owner: '财务 · 黄工', state: 'pending' },
      { node: 'ORD-04 跨部门订单评审', owner: '八部门会签', state: 'pending' },
    ],
  }

  SALES_ORDERS.unshift(order)
  return order
}

/** ORD-01 阻断级校验，错误码段 ORD_2xxx（见 api-conventions.md） */
function assertOrderRules(body: Record<string, string>): void {
  const price = Number(body.originalUnitPrice || '0')

  if (body.orderType === 'formal') {
    if (!body.customerPoNo?.trim()) {
      throw new BizError({
        code: 'ORD_2001',
        message: '正式业务订单必须关联客户原始订单号',
        status: 422,
      })
    }
    if (!body.quotationNo?.trim()) {
      throw new BizError({
        code: 'ORD_2002',
        message: '正式业务订单必须关联已确认报价 / 核价单',
        status: 422,
      })
    }
    if (!price) {
      throw new BizError({ code: 'ORD_2003', message: '正式业务订单价格不能为零', status: 422 })
    }
    if (body.chargeMode !== 'charged') {
      throw new BizError({
        code: 'ORD_2004',
        message: '正式业务订单强制收费，不允许免费或部分收费',
        status: 422,
      })
    }
  }

  if (body.orderType !== 'formal' && body.chargeMode !== 'charged') {
    if (!body.costOwner?.trim() || !body.estimatedCost?.trim() || !body.freeReason?.trim()) {
      throw new BizError({
        code: 'ORD_2011',
        message: '模具 / 样品订单免费或部分收费时，费用承担方、预计成本与原因均为必填',
        status: 422,
      })
    }
  }
}

function applyTailPlan(body: { docNo: string; plan: string }): { docNo: string; plan: string } {
  const shipment = SHIPMENTS.find((item) => item.docNo === body.docNo)
  if (!shipment) {
    throw new BizError({ code: 'SYS_9404', message: '发货单不存在', status: 404 })
  }
  shipment.tailPlan = body.plan as typeof shipment.tailPlan
  return { docNo: body.docNo, plan: body.plan }
}

function renderDocument(body: { templateCode: string }): {
  templateCode: string
  version: string
  generatedAt: string
  downloadUrl: string
} {
  return {
    templateCode: body.templateCode,
    version: 'V1',
    generatedAt: '2026-07-28 17:30',
    downloadUrl: `https://minio.local/docs/${body.templateCode}-preview.pdf`,
  }
}
