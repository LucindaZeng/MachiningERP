import { INVOICE_ERRORS, PERMISSION_CODES } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { DOMAIN_EVENTS, DomainEventPublisher } from '../../../platform/events'
import { NotificationService } from '../../../platform/notification'
import { DOC_TYPES } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { invoiceStateMachine, isIssued, isVoidable } from '../constants/invoice-states'
import { INVOICE_DELIVERY_NODES, INVOICE_TIMELINE_NODES } from '../constants/invoice-timeline'
import {
  FINANCE_ISSUANCE_PORT,
  type FinanceIssuancePort,
} from '../repositories/finance-issuance.port'

import { InvoiceRequestService, type InvoiceActor } from './invoice-request.service'

import type { InvoiceRecord } from '../repositories/invoice-request.repository.port'

/**
 * 开票执行与交付跟踪（业务规格第 9 章）。
 *
 * 两条设计决定写在这里，免得后来人改错：
 * 1. **COMPLETED 在开票那一刻就到**，不等寄出、不等签收。状态不能倒退，
 *    而寄出/签收既不阻断下游也不改变应收；
 * 2. 因此 **INV-04 寄出 / 签收不是状态**，是两个只推进时间线与审计的时间戳事件，
 *    各只能发生一次，且签收必须在寄出之后。
 */
@Injectable()
export class InvoiceIssuanceService {
  constructor(
    private readonly timeline: DocTimelineService,
    private readonly notifications: NotificationService,
    private readonly events: DomainEventPublisher,
    private readonly invoices: InvoiceRequestService,
    @Inject(FINANCE_ISSUANCE_PORT) private readonly finance: FinanceIssuancePort,
  ) {}

  static assertFinance(actor: InvoiceActor): void {
    const allowed = [PERMISSION_CODES.ORDER_FINANCE_REVIEW, PERMISSION_CODES.CUSTOMER_FINANCE_VIEW]
    if (!allowed.some((code) => actor.permissions.includes(code))) {
      throw new BizError(INVOICE_ERRORS.FINANCE_ROLE_REQUIRED)
    }
  }

  /**
   * 送财务开票。**三方金额一致性闸门在这一步**：
   * 「差异处理完成前不得开票」，所以对不上就拦在进入财务之前。
   */
  async sendToFinance(id: string, versionLock: number, actor: InvoiceActor): Promise<InvoiceRecord> {
    InvoiceRequestService.assertSales(actor)
    const current = await this.invoices.load(id)
    invoiceStateMachine.assert(current.status, 'REVIEWING')

    if (!current.amountMatched) {
      throw new BizError(INVOICE_ERRORS.AMOUNT_MISMATCH, {
        message: current.matchNote ?? INVOICE_ERRORS.AMOUNT_MISMATCH.message,
        details: { docNo: current.docNo, matchNote: current.matchNote },
      })
    }

    await this.finance.submitForIssuance({
      invoiceId: current.id,
      docNo: current.docNo,
      customerId: current.customerId,
      invoiceKind: current.invoiceKind,
      amountIncTaxMinor: current.amountIncTaxMinor,
      currency: current.currency,
      originalDocNo: null,
    })

    const now = new Date()
    const updated = await this.invoices.patch(id, versionLock, {
      status: 'REVIEWING',
      updatedBy: actor.userCode,
    })

    await this.enterNode(INVOICE_TIMELINE_NODES.REVIEWING, updated, actor, now)
    await this.invoices.recordTransition(current.status, updated, actor)

    return updated
  }

  /** 财务开出票据并回填发票号 → COMPLETED，同时把应收依据播出去。 */
  async issue(
    id: string,
    versionLock: number,
    invoiceNo: string,
    actor: InvoiceActor,
  ): Promise<InvoiceRecord> {
    InvoiceIssuanceService.assertFinance(actor)
    const trimmed = invoiceNo.trim()
    if (!trimmed) throw new BizError(INVOICE_ERRORS.INVOICE_NO_REQUIRED)

    const current = await this.invoices.load(id)
    invoiceStateMachine.assert(current.status, 'COMPLETED')

    const now = new Date()
    const updated = await this.invoices.patch(id, versionLock, {
      status: 'COMPLETED',
      invoiceNo: trimmed,
      issuedAt: now,
      updatedBy: actor.userCode,
    })

    await this.enterNode(INVOICE_TIMELINE_NODES.COMPLETED, updated, actor, now)
    await this.invoices.recordTransition(current.status, updated, actor)
    await this.events.publish({
      name: DOMAIN_EVENTS.INVOICE_ISSUED,
      payload: {
        invoiceId: updated.id,
        docNo: updated.docNo,
        kind: updated.kind,
        originalId: updated.originalId,
        customerId: updated.customerId,
        invoiceNo: trimmed,
        currency: updated.currency,
        // 红字发票金额本身是负数，订阅方直接相加即可
        amountIncTaxMinor: updated.amountIncTaxMinor.toString(),
        issuedAt: now.toISOString(),
      },
    })
    await this.notify(updated, `发票已开出：${updated.docNo}`, `发票号 ${trimmed}，可安排交付客户。`)

    return updated
  }

  /** INV-04 寄出：状态仍是 COMPLETED，只推进时间线。 */
  async markSent(id: string, versionLock: number, actor: InvoiceActor): Promise<InvoiceRecord> {
    return this.markDelivery(id, versionLock, 'SENT', actor)
  }

  /** INV-04 客户签收：必须先寄出。 */
  async markSigned(id: string, versionLock: number, actor: InvoiceActor): Promise<InvoiceRecord> {
    return this.markDelivery(id, versionLock, 'SIGNED', actor)
  }

  /**
   * 作废：**只在开票之前**。已开出的票在税务系统里存在了，只能红冲。
   * 理由必填——没写理由的作废，事后没人说得清是操作失误还是客户撤单。
   */
  async void(
    id: string,
    versionLock: number,
    reason: string,
    actor: InvoiceActor,
  ): Promise<InvoiceRecord> {
    InvoiceRequestService.assertSales(actor)
    const trimmed = reason.trim()
    if (!trimmed) throw new BizError(INVOICE_ERRORS.REASON_REQUIRED)

    const current = await this.invoices.load(id)
    if (isIssued(current.status)) throw new BizError(INVOICE_ERRORS.VOID_NOT_ALLOWED)
    if (!isVoidable(current.status)) throw new BizError(INVOICE_ERRORS.NOT_EDITABLE)
    invoiceStateMachine.assert(current.status, 'VOID')

    const now = new Date()
    const updated = await this.invoices.patch(id, versionLock, {
      status: 'VOID',
      reasonText: trimmed,
      updatedBy: actor.userCode,
    })

    await this.timeline.close(DOC_TYPES.INVOICE_REQUEST, id, 'ABNORMAL', now)
    await this.invoices.recordTransition(current.status, updated, actor)

    return updated
  }

  private async markDelivery(
    id: string,
    versionLock: number,
    step: 'SENT' | 'SIGNED',
    actor: InvoiceActor,
  ): Promise<InvoiceRecord> {
    InvoiceRequestService.assertSales(actor)
    const current = await this.invoices.load(id)

    if (!isIssued(current.status)) throw new BizError(INVOICE_ERRORS.NOT_ISSUED_YET)
    assertDeliveryOrder(current, step)

    const now = new Date()
    const updated = await this.invoices.patch(id, versionLock, {
      ...(step === 'SENT' ? { sentAt: now } : { signedAt: now }),
      updatedBy: actor.userCode,
    })

    await this.enterNode(INVOICE_DELIVERY_NODES[step], updated, actor, now)
    if (step === 'SIGNED') await this.timeline.close(DOC_TYPES.INVOICE_REQUEST, id, 'DONE', now)

    return updated
  }

  private enterNode(
    node: { node: string; ownerDept: string },
    record: InvoiceRecord,
    actor: InvoiceActor,
    at: Date,
  ): Promise<unknown> {
    return this.timeline.enter({
      docType: DOC_TYPES.INVOICE_REQUEST,
      docId: record.id,
      node: node.node,
      ownerUserCode: actor.userCode,
      ownerDept: node.ownerDept,
      at,
    })
  }

  private notify(record: InvoiceRecord, title: string, body: string): Promise<unknown> {
    return this.notifications.notify({
      recipientUserCode: record.ownerUserCode,
      category: 'INVOICE_REQUEST',
      title,
      body,
      docType: DOC_TYPES.INVOICE_REQUEST,
      docId: record.docNo,
    })
  }
}

/** 寄出与签收各只能一次，且签收必须在寄出之后。 */
export function assertDeliveryOrder(record: InvoiceRecord, step: 'SENT' | 'SIGNED'): void {
  if (step === 'SENT' && record.sentAt) throw new BizError(INVOICE_ERRORS.DELIVERY_OUT_OF_ORDER)
  if (step === 'SIGNED') {
    if (!record.sentAt) throw new BizError(INVOICE_ERRORS.DELIVERY_OUT_OF_ORDER)
    if (record.signedAt) throw new BizError(INVOICE_ERRORS.DELIVERY_OUT_OF_ORDER)
  }
}
