import { PERMISSION_CODES } from '@machining-erp/shared'

import { AuditService } from '../../../platform/audit'
import { DomainEventPublisher } from '../../../platform/events'
import { NotificationService } from '../../../platform/notification'
import { DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { InvoiceContextService } from '../services/invoice-context.service'
import { InvoiceCreditNoteService } from '../services/invoice-credit-note.service'
import { InvoiceIssuanceService } from '../services/invoice-issuance.service'
import { InvoiceRequestService } from '../services/invoice-request.service'

import { FakeInvoiceRepository } from './fakes'

import type { FinanceIssuancePort } from '../repositories/finance-issuance.port'
import type { InvoiceActor } from '../services/invoice-request.service'

export const SALES: InvoiceActor = {
  userCode: 'WFX-2018-0042',
  permissions: [PERMISSION_CODES.SALES_OPERATE],
}
export const FINANCE: InvoiceActor = {
  userCode: 'WFX-2017-0009',
  permissions: [PERMISSION_CODES.ORDER_FINANCE_REVIEW],
}
export const OUTSIDER: InvoiceActor = { userCode: 'WFX-2020-0001', permissions: [] }

let docSeq = 0

export interface Harness {
  invoices: InvoiceRequestService
  issuance: InvoiceIssuanceService
  creditNotes: InvoiceCreditNoteService
  repo: FakeInvoiceRepository
  publish: jest.Mock
  notify: jest.Mock
  audit: jest.Mock
  timelineEnter: jest.Mock
  timelineClose: jest.Mock
  submitForIssuance: jest.Mock
  setStatementTotal: (value: bigint | null) => void
}

/** 出货明细固定两行，合计 124240.00 元 —— 与前端 fixture 的那张票同数。 */
const SHIPMENT_LINES = [
  {
    shipmentId: 'S1',
    shipmentNo: 'SHP-20260706-0046',
    productName: '导轨压板',
    drawingNo: 'MT-7601',
    quantity: '800.000000',
    unitPriceMinor: 3_980n,
    amountMinor: 3_184_000n,
  },
  {
    shipmentId: 'S2',
    shipmentNo: 'SHP-20260715-0051',
    productName: '直线导轨安装座',
    drawingNo: 'MT-7719',
    quantity: '2000.000000',
    unitPriceMinor: 4_620n,
    amountMinor: 9_240_000n,
  },
]

export function buildHarness(): Harness {
  const repo = new FakeInvoiceRepository()

  const publish = jest.fn().mockResolvedValue(undefined)
  const notify = jest.fn().mockResolvedValue(undefined)
  const auditRecord = jest.fn().mockResolvedValue(undefined)
  const timelineEnter = jest.fn().mockResolvedValue(undefined)
  const timelineClose = jest.fn().mockResolvedValue(undefined)
  const submitForIssuance = jest.fn().mockResolvedValue({ invoiceNo: null, acceptedAt: new Date() })

  const docNumber = {
    next: jest.fn(async () => `INV-20260728-${String((docSeq += 1)).padStart(4, '0')}`),
  } as unknown as DocNumberService
  const audit = { record: auditRecord } as unknown as AuditService
  const notifications = { notify } as unknown as NotificationService
  const timeline = {
    enter: timelineEnter,
    close: timelineClose,
    list: jest.fn().mockResolvedValue([]),
  } as unknown as DocTimelineService
  const events = { publish } as unknown as DomainEventPublisher
  const finance = { submitForIssuance } as unknown as FinanceIssuancePort

  const context = {
    customerFacts: jest.fn(async () => ({
      name: '苏州明泰自动化',
      region: 'DOMESTIC' as const,
      invoiceType: 'SPECIAL' as const,
      title: '苏州明泰自动化设备有限公司',
      taxNo: '9132050XXXXXXXXXX1J',
      bankAccount: '中国银行苏州工业园区支行',
      invoiceAddress: '苏州工业园区星龙街 128 号',
      ownerEmail: 'finance@mingtai-auto.com',
      paymentTerm: 'NET_60' as const,
      currency: 'CNY',
    })),
    linesFromShipments: jest.fn(async () => SHIPMENT_LINES),
    shipmentTotalOf: jest.fn(async () => 12_424_000n),
  } as unknown as InvoiceContextService

  const invoices = new InvoiceRequestService(docNumber, audit, timeline, context, repo)
  const issuance = new InvoiceIssuanceService(timeline, notifications, events, invoices, finance)
  const creditNotes = new InvoiceCreditNoteService(docNumber, audit, invoices, repo)

  return {
    invoices,
    issuance,
    creditNotes,
    repo,
    publish,
    notify,
    audit: auditRecord,
    timelineEnter,
    timelineClose,
    submitForIssuance,
    setStatementTotal: () => undefined,
  }
}

/** 建单入参：默认对账金额与出货一致（三方一致，可开票）。 */
export function createInput(statementTotalMinor: bigint | null = 12_424_000n) {
  return {
    customerId: 'C1',
    shipmentIds: ['S1', 'S2'],
    statementId: statementTotalMinor === null ? null : 'STM1',
    statementTotalMinor,
  }
}

/** 走完 建单 → 提交 → 送财务 → 开票，返回已开出的那张票。 */
export async function issuedInvoice(harness: Harness, invoiceNo = 'INV-26-0731') {
  const created = await harness.invoices.create(createInput(), SALES)
  const submitted = await harness.invoices.submit(created.id, created.versionLock, SALES)
  const reviewing = await harness.issuance.sendToFinance(
    submitted.id,
    submitted.versionLock,
    SALES,
  )
  return harness.issuance.issue(reviewing.id, reviewing.versionLock, invoiceNo, FINANCE)
}
