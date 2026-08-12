import { BizError } from '../../biz-error'

import { COST_REPORTS } from './analytics-cost.fixture'
import { MARKET_REPORTS } from './analytics-market.fixture'
import { ORDER_EXTRA_REPORTS } from './analytics-order.fixture'
import { SALES_REPORTS } from './analytics-reports.fixture'
import { SALES_ANALYTICS } from './analytics.fixture'
import { BOM_REQUESTS } from './bom-request.fixture'
import { CUSTOMERS } from './customer.fixture'
import { CUSTOMS_ROUTES } from './customs.mock'
import { DAILY_OPS } from './daily-ops.fixture'
import { DOCGEN_ROUTES } from './docgen.mock'
import { ENGINEERING_CHANGES } from './ecn.fixture'
import { ECN_ROUTES } from './ecn.mock'
import { CUSTOMS_DOSSIERS, SALES_RETURNS, SHIPMENTS } from './fulfilment.fixture'
import { HISTORICAL_QUOTES } from './historical-quote.fixture'
import { INVOICE_REQUESTS } from './invoice.fixture'
import { MATERIAL_PRICES } from './material-price.fixture'
import { ORDER_CHANGES } from './order-change.fixture'
import { ORDER_TRACKINGS } from './order-tracking.fixture'
import { COST_ANALYSES, QUOTATIONS } from './quotation.fixture'
import { QUOTE_CHANGES } from './quote-change.fixture'
import { SALES_ORDERS } from './sales-order.fixture'
import { SALES_RETURN_ROUTES } from './sales-return.mock'
import { STATEMENTS } from './statement.fixture'
import { STOCK_ORDERS } from './stock-order.fixture'
import { ALERTS, APPROVAL_EFFICIENCY, KPI_CARDS, TODOS } from './workbench.fixture'

import type {
  BomRequest,
  InvoiceRequest,
  OrderType,
  SalesOrder,
  Shipment,
  Statement,
} from '@/types/sales.types'

type Handler = (body: unknown) => unknown

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
  'POST /sales-orders': (body) => createSalesOrder(body as Record<string, string>),
  'POST /shipments/tail-plan': (body) => applyTailPlan(body as { docNo: string; plan: string }),
  'POST /documents/render': (body) => renderDocument(body as { templateCode: string }),
}

/**
 * 带路径参数的 mock 路由表。
 * BOM 申请的动作端点（提交/接收/退回/回传）在 mock 下就地改 fixture，
 * 让「切到真实 API 前先在 mock 上走通流程」这件事仍然成立。
 */
const PARAM_ROUTES: Array<{ path: string; handle: (params: string[], body: unknown) => unknown }> = [
  {
    path: 'GET /bom-requests/:id',
    handle: ([id]) => findBomRequest(id),
  },
  {
    path: 'POST /bom-requests/:id/submit',
    handle: ([id]) => patchBomRequest(id, { status: 'submitted' }),
  },
  {
    path: 'POST /bom-requests/:id/claim',
    handle: ([id]) => patchBomRequest(id, { status: 'claimed' }),
  },
  {
    path: 'POST /bom-requests/:id/return',
    handle: ([id]) => patchBomRequest(id, { status: 'returned' }),
  },
  {
    path: 'POST /bom-requests/:id/complete-bom',
    handle: ([id], body) =>
      patchBomRequest(id, {
        bomReady: true,
        status: 'bom-done',
        productCode: (body as { productCode?: string } | undefined)?.productCode,
      }),
  },
  {
    path: 'POST /bom-requests/:id/complete-program',
    handle: ([id]) => patchBomRequest(id, { programReady: true }),
  },
  { path: 'GET /shipments/:id', handle: ([id]) => findShipment(id) },
  { path: 'POST /shipments/:id/pick', handle: ([id]) => advanceShipment(id, 'picking') },
  { path: 'POST /shipments/:id/pack', handle: ([id]) => advanceShipment(id, 'packed') },
  { path: 'POST /shipments/:id/ship', handle: ([id], body) => shipShipment(id, body) },
  { path: 'POST /shipments/:id/sign', handle: ([id]) => advanceShipment(id, 'signed') },
  {
    path: 'POST /shipments/:id/invoice',
    handle: ([id], body) =>
      advanceShipment(id, 'invoiced', { invoiceNo: (body as { invoiceNo?: string })?.invoiceNo }),
  },
  { path: 'POST /shipments/:id/close', handle: ([id]) => closeShipment(id) },
  { path: 'GET /invoice-requests/:id', handle: ([id]) => findInvoice(id) },
  { path: 'POST /invoice-requests/:id/submit', handle: ([id]) => patchInvoice(id, { status: 'submitted' }) },
  {
    path: 'POST /invoice-requests/:id/send-to-finance',
    handle: ([id]) => sendInvoiceToFinance(id),
  },
  {
    path: 'POST /invoice-requests/:id/issue',
    handle: ([id], body) =>
      patchInvoice(id, {
        status: 'completed',
        invoiceNo: (body as { invoiceNo?: string })?.invoiceNo,
        issuedAt: new Date().toISOString(),
      }),
  },
  { path: 'POST /invoice-requests/:id/mark-sent', handle: ([id]) => findInvoice(id) },
  { path: 'POST /invoice-requests/:id/mark-signed', handle: ([id]) => findInvoice(id) },
  {
    path: 'POST /invoice-requests/:id/void',
    handle: ([id], body) =>
      patchInvoice(id, { status: 'void', voidReason: (body as { reason?: string })?.reason }),
  },
  ...SALES_RETURN_ROUTES,
  ...CUSTOMS_ROUTES,
  ...DOCGEN_ROUTES,
  ...ECN_ROUTES,
  { path: 'GET /statements/:id', handle: ([id]) => findStatement(id) },
  { path: 'POST /statements/:id/send', handle: ([id]) => sendStatement(id) },
  { path: 'POST /statements/:id/confirm', handle: ([id]) => patchStatement(id, { status: 'confirmed' }) },
  {
    path: 'POST /statements/:id/dispute',
    handle: ([id], body) =>
      patchStatement(id, {
        status: 'disputed',
        differenceNote: (body as { differenceNote?: string })?.differenceNote,
      }),
  },
  { path: 'POST /statements/:id/settle', handle: ([id]) => patchStatement(id, { status: 'settled' }) },
  {
    path: 'PUT /statements/:id/lines/:lineId/matched',
    handle: ([id, lineId], body) =>
      setStatementLineMatched(id, lineId, (body as { matched?: boolean })?.matched === true),
  },
]

/**
 * 出货：mock 下就地推进状态。真实后端在 packed → shipped 之间有品质放行 +
 * 财务信用双闸门，mock 无从判定，因此这里一律放行——**mock 通过不代表真实环境通过**。
 */
function findShipment(id: string | undefined): Shipment {
  const record = SHIPMENTS.find((item) => item.id === id || item.docNo === id)
  if (!record) {
    throw new BizError({ code: 'ORD_2500', message: '出货单不存在', status: 404 })
  }
  return record
}

function advanceShipment(
  id: string | undefined,
  status: Shipment['status'],
  patch: Partial<Shipment> = {},
): Shipment {
  const record = findShipment(id)
  Object.assign(record, patch, { status })
  return record
}

function shipShipment(id: string | undefined, body: unknown): Shipment {
  const input = body as { carrier?: string; trackingNo?: string } | undefined
  const record = advanceShipment(id, 'shipped', {
    carrier: input?.carrier,
    trackingNo: input?.trackingNo,
  })
  // 出运后表头「已发」才亮出来，与后端 toShipmentView 同一口径
  record.shippedQty = record.packedQty
  return record
}

/** 结案前的数量平衡校验，与后端 collectTailImbalances 同一条规则。 */
function closeShipment(id: string | undefined): Shipment {
  const record = findShipment(id)
  if (Number(record.tailQty) > 0 && !record.tailPlan) {
    throw new BizError({
      code: 'ORD_2509',
      message: `尾数 ${record.tailQty} 件未处置，数量不平衡，无法结案`,
      status: 422,
    })
  }
  return advanceShipment(id, 'closed')
}

function findInvoice(id: string | undefined): InvoiceRequest {
  const record = INVOICE_REQUESTS.find((item) => item.id === id || item.docNo === id)
  if (!record) {
    throw new BizError({ code: 'ORD_2700', message: '发票申请不存在', status: 404 })
  }
  return record
}

function patchInvoice(id: string | undefined, patch: Partial<InvoiceRequest>): InvoiceRequest {
  const record = findInvoice(id)
  Object.assign(record, patch)
  return record
}

/** 三方金额不一致时不许送财务——与后端 ORD_2705 同一条规则。 */
function sendInvoiceToFinance(id: string | undefined): InvoiceRequest {
  const record = findInvoice(id)
  if (!record.amountMatched) {
    throw new BizError({
      code: 'ORD_2705',
      message: record.matchNote ?? '开票金额与出货、对账不一致，请先在对账单完成差异处理',
      status: 422,
    })
  }
  return patchInvoice(id, { status: 'reviewing' })
}

function findStatement(id: string | undefined): Statement {
  const record = STATEMENTS.find((item) => item.id === id || item.docNo === id)
  if (!record) {
    throw new BizError({ code: 'ORD_2600', message: '对账单不存在', status: 404 })
  }
  return record
}

function patchStatement(id: string | undefined, patch: Partial<Statement>): Statement {
  const record = findStatement(id)
  Object.assign(record, patch)
  return record
}

/** 差异非零而没写说明的对账单不许发出——与后端 assertDifferenceExplained 同一条规则。 */
function sendStatement(id: string | undefined): Statement {
  const record = findStatement(id)
  if (Number(record.differenceAmount) !== 0 && !record.differenceNote) {
    throw new BizError({
      code: 'ORD_2602',
      message: '对账差异不为零时必须填写差异说明',
      status: 422,
    })
  }
  return patchStatement(id, { status: 'sent', sentAt: new Date().toISOString() })
}

function setStatementLineMatched(
  id: string | undefined,
  lineId: string | undefined,
  matched: boolean,
): Statement {
  const record = findStatement(id)
  const line = record.lines.find((item) => item.docNo === lineId)
  if (!line) {
    throw new BizError({ code: 'ORD_2605', message: '对账明细行不存在', status: 404 })
  }
  line.matched = matched
  return record
}

/** mock 下就地改 fixture；bomReady 与 programReady 分别落，绝不合并。 */
function patchBomRequest(id: string | undefined, patch: Partial<BomRequest>): BomRequest {
  const record = findBomRequest(id)
  Object.assign(record, patch)
  // 两个开关都开了才是 all-done —— 与后端 deriveStatus 同一口径
  if (record.bomReady && record.programReady) record.status = 'all-done'
  return record
}

function findBomRequest(id: string | undefined): BomRequest {
  const record = BOM_REQUESTS.find((item) => item.id === id || item.docNo === id)
  if (!record) {
    throw new BizError({ code: 'ORD_2400', message: 'BOM 申请不存在', status: 404 })
  }
  return record
}

/**
 * 带路径参数的 mock 路由。键里的 `:id` 匹配一段非斜杠字符，
 * 命中后把参数传给处理器——真实后端有 `/bom-requests/:id/submit` 这类动作端点，
 * mock 若只支持字面量路径，一接真实 API 就会整片 404。
 */
const PARAM_HANDLERS: Array<{
  pattern: RegExp
  handle: (params: string[], body: unknown) => unknown
}> = PARAM_ROUTES.map((route) => ({
  pattern: new RegExp(`^${route.path.replace(/:[^/]+/g, '([^/]+)')}$`),
  handle: route.handle,
}))

export function dispatchSalesMock(route: string, body: unknown): { handled: boolean; data?: unknown } {
  const handler = HANDLERS[route]
  if (handler) return { handled: true, data: handler(body) }

  for (const entry of PARAM_HANDLERS) {
    const matched = entry.pattern.exec(route)
    if (matched) return { handled: true, data: entry.handle(matched.slice(1), body) }
  }

  return { handled: false }
}

function createSalesOrder(body: Record<string, string>): SalesOrder {
  assertOrderRules(body)

  orderSequence += 1

  const unitPrice = Number(body.originalUnitPrice || '0')
  if (Number.isNaN(unitPrice)) {
    throw new BizError({ code: 'ORD_2501', message: '订单单价格式不正确', status: 422 })
  }

  const customer = CUSTOMERS.find((item) => item.code === body.customerCode)
  const amount = (unitPrice * Number(body.quantity || '0')).toFixed(2)

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
    unitPrice: unitPrice.toFixed(2),
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
