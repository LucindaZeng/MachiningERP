import { PERMISSION_CODES } from '@machining-erp/shared'

import { AuditService } from '../../../platform/audit'
import { DomainEventPublisher } from '../../../platform/events'
import { NotificationService } from '../../../platform/notification'
import { DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { ShipGateService } from '../services/ship-gate.service'
import { ShipmentContextService } from '../services/shipment-context.service'
import { ShipmentFlowService } from '../services/shipment-flow.service'
import { ShipmentPostingService } from '../services/shipment-posting.service'
import { ShipmentTailService } from '../services/shipment-tail.service'
import { ShipmentService } from '../services/shipment.service'
import { StatementSourceRegistry } from '../services/statement-source.registry'
import { StatementSourceService } from '../services/statement-source.service'
import { StatementService } from '../services/statement.service'

import {
  FakeQcReleasePort,
  FakeReceiptPort,
  FakeShipmentRepository,
  FakeStatementRepository,
  FakeStatementSourcePort,
} from './fakes'

import type { OrderLineFacts } from '../services/shipment-context.service'
import type { ShipmentActor } from '../services/shipment.service'
import type { PaymentTerm } from '@prisma/client'

export const SALES: ShipmentActor = {
  userCode: 'WFX-2018-0042',
  permissions: [PERMISSION_CODES.SALES_OPERATE],
}
export const OUTSIDER: ShipmentActor = { userCode: 'WFX-2019-0200', permissions: [] }

export const ORDER_LINES: OrderLineFacts[] = [
  { orderLineId: 'OL1', orderedQty: '1500.000000', unitPriceMinor: 2_490n },
  { orderLineId: 'OL2', orderedQty: '1500.000000', unitPriceMinor: 750n },
]

let docSeq = 0

export interface Harness {
  shipments: ShipmentService
  flow: ShipmentFlowService
  tail: ShipmentTailService
  gate: ShipGateService
  statements: StatementService
  repo: FakeShipmentRepository
  statementRepo: FakeStatementRepository
  qc: FakeQcReleasePort
  receipts: FakeReceiptPort
  sources: FakeStatementSourcePort
  publish: jest.Mock
  notify: jest.Mock
  audit: jest.Mock
  timelineEnter: jest.Mock
  timelineClose: jest.Mock
  setPaymentTerm: (term: PaymentTerm) => void
}

/**
 * 一套假件搭起整个出货 + 对账链路。
 * 跨模块的三个依赖（订单、客户、用户目录）在这里换成可编程的假对象——
 * 本模块的测试不该因为 contract-order 改了个字段就红。
 */
export function buildHarness(): Harness {
  const repo = new FakeShipmentRepository()
  const statementRepo = new FakeStatementRepository()
  const qc = new FakeQcReleasePort()
  const receipts = new FakeReceiptPort()
  const sources = new FakeStatementSourcePort()

  const publish = jest.fn().mockResolvedValue(undefined)
  const notify = jest.fn().mockResolvedValue(undefined)
  const auditRecord = jest.fn().mockResolvedValue(undefined)
  const timelineEnter = jest.fn().mockResolvedValue(undefined)
  const timelineClose = jest.fn().mockResolvedValue(undefined)

  const docNumber = {
    next: jest.fn(async () => `SHP-20260727-${String((docSeq += 1)).padStart(4, '0')}`),
  } as unknown as DocNumberService
  const audit = { record: auditRecord } as unknown as AuditService
  const notifications = { notify } as unknown as NotificationService
  const timeline = {
    enter: timelineEnter,
    close: timelineClose,
    list: jest.fn().mockResolvedValue([]),
  } as unknown as DocTimelineService
  const events = { publish } as unknown as DomainEventPublisher

  let paymentTerm: PaymentTerm = 'NET_60'
  const context = {
    orderContext: jest.fn(async () => ({
      orderId: 'O1',
      orderNo: 'SO-20260710-0085',
      currency: 'CNY',
      lines: ORDER_LINES,
    })),
    customerContext: jest.fn(async () => ({
      customerCode: 'C-US-007',
      customerName: 'Radex Instruments Inc.',
      paymentTerm,
      currency: 'CNY',
    })),
    displayName: jest.fn(async () => '陈志强'),
    namingFor: jest.fn(async () => ({
      orderNo: 'SO-20260710-0085',
      customerName: 'Radex Instruments Inc.',
      ownerName: '陈志强',
    })),
  } as unknown as ShipmentContextService

  const shipments = new ShipmentService(docNumber, audit, timeline, repo)
  const gate = new ShipGateService(qc, receipts)
  const posting = new ShipmentPostingService(events, repo)
  const flow = new ShipmentFlowService(
    audit,
    notifications,
    timeline,
    shipments,
    gate,
    posting,
    context,
    repo,
  )
  const tail = new ShipmentTailService(audit, events, shipments, repo)
  // 注册表在测试里直接接上假来源，行为与运行时一致
  const registry = new StatementSourceRegistry()
  registry.registerInvoiceSource({
    invoicesInPeriod: async () => sources.invoicesInPeriod(),
  })
  registry.registerReturnSource({
    // stub 读端口只给出通用条目；退货来源的两个附加字段在这里补默认值：
    // 一律按「退货、未被红字承接」处理，与 sales-return 落地前的口径一致
    returnsInPeriod: async () =>
      (await sources.returnsInPeriod()).map((entry) => ({
        ...entry,
        lineType: 'RETURN' as const,
        settledByCreditNote: false,
      })),
  })
  const sourceService = new StatementSourceService(repo, sources, receipts, registry)
  const statements = new StatementService(
    docNumber,
    audit,
    sourceService,
    context,
    statementRepo,
  )

  return {
    shipments,
    flow,
    tail,
    gate,
    statements,
    repo,
    statementRepo,
    qc,
    receipts,
    sources,
    publish,
    notify,
    audit: auditRecord,
    timelineEnter,
    timelineClose,
    setPaymentTerm: (term) => {
      paymentTerm = term
    },
  }
}

/** 两行明细：第一行少发 14 件留尾数，第二行发齐。 */
export function draftLines(): Parameters<ShipmentService['create']>[1] {
  return [
    {
      sequence: 1,
      orderLineId: 'OL1',
      productName: '探头支架',
      drawingNo: 'RX-3390',
      itemCode: 'P-RX3390-D-02',
      batchNo: 'B26071502',
      orderedQty: '1500.000000',
      qualifiedQty: '1486.000000',
      packedQty: '1486.000000',
      shippedQty: '1486.000000',
      unitPriceMinor: 2_490n,
    },
    {
      sequence: 2,
      orderLineId: 'OL2',
      productName: '探头支架安装座',
      drawingNo: 'RX-3391',
      itemCode: 'P-RX3391-A-01',
      batchNo: 'B26071503',
      orderedQty: '1500.000000',
      qualifiedQty: '1500.000000',
      packedQty: '1500.000000',
      shippedQty: '1500.000000',
      unitPriceMinor: 750n,
    },
  ]
}

export function draftHeader(): Parameters<ShipmentService['create']>[0] {
  return {
    orderId: 'O1',
    customerId: 'C1',
    deliveryAddressId: null,
    currency: 'CNY',
    carrier: null,
    trackingNo: null,
    ownerUserCode: SALES.userCode,
  }
}
