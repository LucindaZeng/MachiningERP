import { Injectable } from '@nestjs/common'

import { DOC_TYPES } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { UserDirectoryService } from '../../identity'
import { CustomerService } from '../../masterdata'
import { toShipmentTimelineView } from '../../shipment'

import { InvoiceRequestService } from './invoice-request.service'
import { toInvoiceRequestView } from './invoice-view.mapper'

import type { InvoiceRequestView } from '../dto/invoice-request-view.dto'
import type {
  InvoiceQuery,
  InvoiceRecord,
} from '../repositories/invoice-request.repository.port'

/**
 * 读侧组装：单据 + 客户抬头 + 业务员姓名 + 节点计时。
 * 单拎出来是因为 controller 只该做 HTTP 编解码，三处取数塞进去就成了业务层。
 */
@Injectable()
export class InvoiceReadService {
  constructor(
    private readonly invoices: InvoiceRequestService,
    private readonly customers: CustomerService,
    private readonly users: UserDirectoryService,
    private readonly timeline: DocTimelineService,
  ) {}

  async render(record: InvoiceRecord): Promise<InvoiceRequestView> {
    const [customer, owner, nodes, original] = await Promise.all([
      this.customers.invoiceProfileFor(record.customerId),
      this.users.findByUserCode(record.ownerUserCode),
      this.timeline.list(DOC_TYPES.INVOICE_REQUEST, record.id),
      record.originalId ? this.invoices.load(record.originalId) : Promise.resolve(null),
    ])

    return toInvoiceRequestView(
      record,
      {
        customerName: customer.name,
        customerCode: customer.code,
        statementNo: null,
        ownerName: owner?.displayName ?? record.ownerUserCode,
        originalDocNo: original?.docNo ?? null,
      },
      toShipmentTimelineView(nodes, owner?.displayName ?? record.ownerUserCode),
    )
  }

  async list(query: InvoiceQuery): Promise<InvoiceRequestView[]> {
    const records = await this.invoices.list(query)
    return Promise.all(records.map((record) => this.render(record)))
  }

  async detail(id: string): Promise<InvoiceRequestView> {
    return this.render(await this.invoices.load(id))
  }
}
