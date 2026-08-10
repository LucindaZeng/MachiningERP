import { INVOICE_ERRORS, PERMISSION_CODES } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { invoiceStateMachine } from '../constants/invoice-states'
import { INVOICE_TIMELINE_NODES } from '../constants/invoice-timeline'
import {
  INVOICE_REPOSITORY,
  type InvoiceQuery,
  type InvoiceRecord,
  type InvoiceRepositoryPort,
} from '../repositories/invoice-request.repository.port'

import { checkAmountMatch } from './invoice-amount-match'
import { autofillInvoice } from './invoice-autofill'
import { InvoiceContextService } from './invoice-context.service'

export interface InvoiceActor {
  userCode: string
  permissions: readonly string[]
}

export interface CreateInvoiceInput {
  customerId: string
  /** 要开票的出货单；金额、明细、税率全部据此自动带出 */
  shipmentIds: readonly string[]
  statementId: string | null
  /** 对账单上对应的入账金额，用于三方比对；不关联对账单时为 null */
  statementTotalMinor: bigint | null
}

/**
 * 发票申请：建单与查询（业务规格第 9 章）。
 *
 * 建单时**一切自动带出**——金额、税率、发票种类、抬头税号地址都来自
 * 客户档案与出货单，业务只选客户与出货单。手填这些字段等于给开错票留口子。
 * 带出来的开票信息随即冻结在申请上：客户档案三个月后改了地址，
 * 不该动到已经开出去的那张票。
 */
@Injectable()
export class InvoiceRequestService {
  constructor(
    private readonly docNumber: DocNumberService,
    private readonly audit: AuditService,
    private readonly timeline: DocTimelineService,
    private readonly context: InvoiceContextService,
    @Inject(INVOICE_REPOSITORY) private readonly repository: InvoiceRepositoryPort,
  ) {}

  static assertSales(actor: InvoiceActor): void {
    const allowed = [PERMISSION_CODES.SALES_OPERATE, PERMISSION_CODES.INVOICE_APPLY]
    if (!allowed.some((code) => actor.permissions.includes(code))) {
      throw new BizError(INVOICE_ERRORS.SALES_ROLE_REQUIRED)
    }
  }

  async create(input: CreateInvoiceInput, actor: InvoiceActor): Promise<InvoiceRecord> {
    InvoiceRequestService.assertSales(actor)
    if (input.shipmentIds.length === 0) throw new BizError(INVOICE_ERRORS.LINES_REQUIRED)

    const [customer, lineFacts] = await Promise.all([
      this.context.customerFacts(input.customerId),
      this.context.linesFromShipments(input.shipmentIds),
    ])
    if (lineFacts.length === 0) throw new BizError(INVOICE_ERRORS.LINES_REQUIRED)

    const now = new Date()
    const filled = autofillInvoice(customer, lineFacts, now)
    const shipmentTotal = lineFacts.reduce((sum, line) => sum + line.amountMinor, 0n)
    const match = checkAmountMatch({
      invoiceExTaxMinor: filled.amountExTaxMinor,
      shipmentTotalMinor: shipmentTotal,
      statementTotalMinor: input.statementTotalMinor,
      currency: customer.currency,
    })

    const docNo = await this.docNumber.next(DOC_TYPES.INVOICE_REQUEST)
    const record = await this.repository.create({
      ...filled,
      docNo,
      kind: 'INVOICE',
      originalId: null,
      customerId: input.customerId,
      statementId: input.statementId,
      currency: customer.currency,
      amountMatched: match.matched,
      matchNote: match.note,
      ownerUserCode: actor.userCode,
      reasonText: null,
      createdBy: actor.userCode,
      lines: filled.lines,
    })

    await this.timeline.enter({
      docType: DOC_TYPES.INVOICE_REQUEST,
      docId: record.id,
      node: INVOICE_TIMELINE_NODES.SUBMITTED.node,
      ownerUserCode: actor.userCode,
      ownerDept: INVOICE_TIMELINE_NODES.SUBMITTED.ownerDept,
      at: now,
    })
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'invoice-request.create',
      entityType: 'InvoiceRequest',
      entityId: record.docNo,
      after: {
        customerId: input.customerId,
        invoiceKind: record.invoiceKind,
        amountIncTaxMinor: record.amountIncTaxMinor.toString(),
        amountMatched: record.amountMatched,
      },
    })

    return record
  }

  /** 提交复核。金额对不上照样能提交——闸门在送财务那一步，与前端 fixture 一致。 */
  async submit(id: string, versionLock: number, actor: InvoiceActor): Promise<InvoiceRecord> {
    InvoiceRequestService.assertSales(actor)
    const current = await this.load(id)
    invoiceStateMachine.assert(current.status, 'SUBMITTED')

    const updated = await this.patch(id, versionLock, {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      updatedBy: actor.userCode,
    })
    await this.recordTransition(current.status, updated, actor)

    return updated
  }

  async load(id: string): Promise<InvoiceRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new BizError(INVOICE_ERRORS.NOT_FOUND)
    return record
  }

  list(query: InvoiceQuery): Promise<InvoiceRecord[]> {
    return this.repository.list(query)
  }

  async patch(
    id: string,
    versionLock: number,
    patch: Parameters<InvoiceRepositoryPort['patch']>[2],
  ): Promise<InvoiceRecord> {
    const updated = await this.repository.patch(id, versionLock, patch)
    if (!updated) throw new BizError(INVOICE_ERRORS.NOT_EDITABLE)
    return updated
  }

  recordTransition(
    from: string,
    record: InvoiceRecord,
    actor: InvoiceActor,
  ): Promise<unknown> {
    return this.audit.record({
      actorUserCode: actor.userCode,
      action: `invoice-request.${record.status.toLowerCase()}`,
      entityType: 'InvoiceRequest',
      entityId: record.docNo,
      before: { status: from },
      after: { status: record.status },
    })
  }
}
