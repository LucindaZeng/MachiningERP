import { INVOICE_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import { isIssued } from '../constants/invoice-states'
import {
  INVOICE_REPOSITORY,
  type CreateInvoiceData,
  type InvoiceRecord,
  type InvoiceRepositoryPort,
} from '../repositories/invoice-request.repository.port'

import { remainingCreditable } from './invoice-amount-match'
import { InvoiceRequestService, type InvoiceActor } from './invoice-request.service'

/**
 * 红字发票（红冲，业务规格第 9 章「红冲/作废须关联原发票并说明原因」）。
 *
 * 三条硬规则：
 * 1. **原票绝不被改**——红冲产生一张**新单据**，原票原样留着，税务上本来就该如此；
 * 2. 只有已开出的票能红冲，没开出的直接作废（那条在 issuance 服务里）；
 * 3. 累计红冲不得超过原票金额，否则会冲出一笔没人解释得清的负应收。
 *
 * 红字单与正票**同表同状态机同编号流**：它就是「带负号且挂着父单」的发票申请，
 * 前端不用为它另做一套列表。
 */
@Injectable()
export class InvoiceCreditNoteService {
  constructor(
    private readonly docNumber: DocNumberService,
    private readonly audit: AuditService,
    private readonly invoices: InvoiceRequestService,
    @Inject(INVOICE_REPOSITORY) private readonly repository: InvoiceRepositoryPort,
  ) {}

  /**
   * 开红字发票申请。金额取负；不传金额时按原票全额冲。
   * 生成的红字单走与正票完全一样的 SUBMITTED → REVIEWING → COMPLETED。
   */
  async create(
    originalId: string,
    reason: string,
    amountIncTaxMinor: bigint | null,
    actor: InvoiceActor,
  ): Promise<InvoiceRecord> {
    InvoiceRequestService.assertSales(actor)
    const trimmed = reason.trim()
    if (!trimmed) throw new BizError(INVOICE_ERRORS.REASON_REQUIRED)

    const original = await this.invoices.load(originalId)
    if (!isIssued(original.status)) {
      throw new BizError(INVOICE_ERRORS.CREDIT_NOTE_REQUIRES_ISSUED)
    }

    const credited = await this.repository.creditedAmountOf(original.id)
    const remaining = remainingCreditable(original.amountIncTaxMinor, credited)
    const requested = absOf(amountIncTaxMinor ?? original.amountIncTaxMinor)

    if (requested === 0n || requested > remaining) {
      throw new BizError(INVOICE_ERRORS.CREDIT_NOTE_EXCEEDS_ORIGINAL, {
        message:
          `原票 ${original.docNo} 还能红冲 ${remaining}（最小货币单位），` +
          `本次申请 ${requested}`,
        details: {
          originalDocNo: original.docNo,
          originalAmountMinor: original.amountIncTaxMinor.toString(),
          alreadyCreditedMinor: credited.toString(),
          remainingMinor: remaining.toString(),
        },
      })
    }

    const docNo = await this.docNumber.next(DOC_TYPES.INVOICE_REQUEST)
    const record = await this.repository.create(
      buildCreditNoteData(original, { docNo, requested, reason: trimmed, actorUserCode: actor.userCode }),
    )

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'invoice-request.credit-note',
      entityType: 'InvoiceRequest',
      entityId: record.docNo,
      after: {
        originalDocNo: original.docNo,
        reason: trimmed,
        amountIncTaxMinor: record.amountIncTaxMinor.toString(),
        remainingBeforeMinor: remaining.toString(),
      },
    })

    return record
  }
}

/** 红字单的字段全部由原票推导：抬头照抄，金额取负，按比例摊到各行。 */
export function buildCreditNoteData(
  original: InvoiceRecord,
  input: { docNo: string; requested: bigint; reason: string; actorUserCode: string },
): CreateInvoiceData {
  const ratio = scaleOf(input.requested, original.amountIncTaxMinor)

  return {
    docNo: input.docNo,
    kind: 'CREDIT_NOTE',
    originalId: original.id,
    customerId: original.customerId,
    invoiceKind: original.invoiceKind,
    statementId: original.statementId,
    currency: original.currency,
    // 全部取负：订阅方与对账单直接相加即可，不用各自判符号
    amountExTaxMinor: -applyRatio(original.amountExTaxMinor, ratio),
    taxAmountMinor: -applyRatio(original.taxAmountMinor, ratio),
    amountIncTaxMinor: -input.requested,
    title: original.title,
    taxNo: original.taxNo,
    bankAccount: original.bankAccount,
    address: original.address,
    deliveryMethod: original.deliveryMethod,
    deliveryTarget: original.deliveryTarget,
    // 红字单的金额来自原票，天然一致，不必再走三方比对
    amountMatched: true,
    matchNote: null,
    expectedPaymentDate: null,
    ownerUserCode: input.actorUserCode,
    reasonText: input.reason,
    createdBy: input.actorUserCode,
    lines: original.lines.map((line) => ({
      sequence: line.sequence,
      shipmentId: line.shipmentId,
      shipmentNo: line.shipmentNo,
      productName: line.productName,
      drawingNo: line.drawingNo,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      amountMinor: -applyRatio(line.amountMinor, ratio),
      taxRateBps: line.taxRateBps,
      taxAmountMinor: -applyRatio(line.taxAmountMinor, ratio),
    })),
  }
}

function absOf(value: bigint): bigint {
  return value < 0n ? -value : value
}

/** 部分红冲时按比例摊到各行；分母为 0 时按全额。 */
function scaleOf(requested: bigint, total: bigint): { numerator: bigint; denominator: bigint } {
  return total === 0n ? { numerator: 1n, denominator: 1n } : { numerator: requested, denominator: total }
}

function applyRatio(value: bigint, ratio: { numerator: bigint; denominator: bigint }): bigint {
  return (absOf(value) * ratio.numerator) / ratio.denominator
}
