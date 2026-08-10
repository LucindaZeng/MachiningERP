import { PERMISSION_CODES } from '@machining-erp/shared'

import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { OrderReviewService } from '../services/order-review.service'
import { SalesOrderService } from '../services/sales-order.service'
import { StockConsumptionService } from '../services/stock-consumption.service'

import { FakeSalesOrderRepository, FakeStockConsumptionRepository } from './fakes'

import type { OrderActor, OrderContext, SalesOrderDraftPayload } from '../services/sales-order.service'
import type { SalesOrderType } from '@prisma/client'

export const SALES: OrderActor = {
  userCode: 'WFX-2018-0042',
  permissions: [PERMISSION_CODES.SALES_OPERATE],
}
export const MANAGER: OrderActor = {
  userCode: 'WFX-2015-0007',
  permissions: [PERMISSION_CODES.ORDER_APPROVE],
}
export const FINANCE: OrderActor = {
  userCode: 'WFX-2016-0031',
  permissions: [PERMISSION_CODES.ORDER_FINANCE_REVIEW],
}
export const GM: OrderActor = {
  userCode: 'WFX-2012-0001',
  permissions: [PERMISSION_CODES.STOCK_ORDER_GM_APPROVE],
}
export const CROSS: OrderActor = {
  userCode: 'WFX-2017-0088',
  permissions: [PERMISSION_CODES.ORDER_CROSS_REVIEW],
}

export interface Harness {
  orders: SalesOrderService
  review: OrderReviewService
  stock: StockConsumptionService
  orderRepo: FakeSalesOrderRepository
  consumptionRepo: FakeStockConsumptionRepository
  notify: jest.Mock
  timelineEnter: jest.Mock
  timelineClose: jest.Mock
}

let docSeq = 0

export function buildHarness(): Harness {
  const consumptionRepo = new FakeStockConsumptionRepository()
  const orderRepo = new FakeSalesOrderRepository(consumptionRepo)

  const notify = jest.fn().mockResolvedValue(undefined)
  const timelineEnter = jest.fn().mockResolvedValue(undefined)
  const timelineClose = jest.fn().mockResolvedValue(undefined)

  const docNumber = {
    next: jest.fn(async (type: string) => `${type}${String((docSeq += 1)).padStart(4, '0')}`),
  } as unknown as DocNumberService
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService
  const notifications = { notify } as unknown as NotificationService
  const timeline = { enter: timelineEnter, close: timelineClose } as unknown as DocTimelineService

  const orders = new SalesOrderService(docNumber, audit, timeline, orderRepo)
  const review = new OrderReviewService(orders, audit, notifications, timeline, orderRepo)
  const stock = new StockConsumptionService(audit, orderRepo, consumptionRepo)

  return { orders, review, stock, orderRepo, consumptionRepo, notify, timelineEnter, timelineClose }
}

export const READY_CONTEXT: OrderContext = {
  customerReadyForOrder: true,
  bomConfirmed: { 1: true, 2: true },
}

export function draft(
  orderType: SalesOrderType = 'FORMAL',
  overrides: Partial<SalesOrderDraftPayload> = {},
): SalesOrderDraftPayload {
  const isStock = orderType === 'STOCK_PREP'

  return {
    customerId: 'CU1',
    orderType,
    chargeMode: isStock ? 'INTERNAL' : 'CHARGED',
    customerPoNo: isStock ? null : 'PO-2026-0815',
    customerPoFile: isStock ? null : 'po-2026-0815.pdf',
    currency: 'CNY',
    taxRateBps: 1300,
    internalDueDate: isStock ? new Date('2026-10-01T00:00:00Z') : null,
    costOwner: isStock ? '公司承担' : null,
    freeReason: isStock ? '常备库存' : null,
    estimatedCostMinor: isStock ? 100_000n : null,
    lines: [
      {
        sequence: 1,
        quotationId: 'Q1',
        quotationItemId: 'QI1',
        costAnalysisId: 'CA1',
        productName: '12K Live Front Panel',
        drawingNo: 'BCM-2607',
        drawingVersionId: 'DV1',
        revision: 'REV A',
        itemCode: '1008010001',
        bomRequestNo: 'BOMR0001',
        quantity: '100',
        unitPriceMinor: 32_000n,
        deliveryDate: isStock ? null : new Date('2026-09-30T00:00:00Z'),
        remark: null,
      },
    ],
    ...overrides,
  }
}
