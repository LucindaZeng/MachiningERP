import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'

import { StatementSourceRegistry, type StatementInvoiceSource, SourceDocumentEntry  } from '../../shipment'
import {
  INVOICE_REPOSITORY,
  type InvoiceRepositoryPort,
} from '../repositories/invoice-request.repository.port'


/**
 * 对账单「开票」列的真实来源——替换 shipment 里那个返回空集的 stub。
 *
 * 口径与正票一致：**按开票日（issuedAt）计入**，不是按申请日，也不是按寄出/签收。
 * 红字发票金额本来就是负数，直接一起返回，对账单相加即得净开票额。
 *
 * 注册进 registry 而不是被 shipment 直接注入：两个模块互相需要对方
 * （本模块建单要读出货明细），走注册表才不会成环。
 */
@Injectable()
export class InvoiceStatementSource implements StatementInvoiceSource, OnModuleInit {
  constructor(
    private readonly registry: StatementSourceRegistry,
    @Inject(INVOICE_REPOSITORY) private readonly invoices: InvoiceRepositoryPort,
  ) {}

  onModuleInit(): void {
    this.registry.registerInvoiceSource(this)
  }

  async invoicesInPeriod(customerId: string, from: Date, to: Date): Promise<SourceDocumentEntry[]> {
    const records = await this.invoices.list({
      customerId,
      status: 'COMPLETED',
      issuedFrom: from,
      issuedTo: to,
      limit: 1000,
    })

    return records
      .filter((record) => record.issuedAt !== null)
      .map((record) => ({
        occurredAt: record.issuedAt as Date,
        docNo: record.invoiceNo ?? record.docNo,
        productName: null,
        quantity: null,
        amountMinor: record.amountIncTaxMinor,
        remark: record.kind === 'CREDIT_NOTE' ? `红冲（${record.reasonText ?? '—'}）` : null,
      }))
  }
}
