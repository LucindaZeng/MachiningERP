import { Inject, Injectable } from '@nestjs/common'

import { RECEIPT_PORT, type ReceiptPort } from '../repositories/receipt.port'
import {
  SHIPMENT_REPOSITORY,
  type ShipmentRepositoryPort,
} from '../repositories/shipment.repository.port'
import {
  STATEMENT_SOURCE_PORT,
  type StatementSourcePort,
} from '../repositories/statement-source.port'

import { lineAmountMinor } from './shipment-view.mapper'
import { StatementSourceRegistry } from './statement-source.registry'

import type { AggregationEntry } from './statement-aggregation'

/**
 * 对账明细的取数：**只从源单来**（业务规格第 7 章「业务不得手工修改金额」）。
 *
 * 发货明细本模块自己有；开票、退货折让、回款分别走 statement-source 与 receipt
 * 两个读端口。四个来源在这里汇成一条流水，汇总口径（statement-aggregation.ts）
 * 因此不需要知道数据是从哪个模块来的。
 */
@Injectable()
export class StatementSourceService {
  constructor(
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepositoryPort,
    @Inject(STATEMENT_SOURCE_PORT) private readonly sources: StatementSourcePort,
    @Inject(RECEIPT_PORT) private readonly receipts: ReceiptPort,
    private readonly registry: StatementSourceRegistry,
  ) {}

  /** 期间内已实际发出的出货单（计划中的不入账——货还在厂里）。 */
  private async shipmentEntries(
    customerId: string,
    from: Date,
    to: Date,
  ): Promise<AggregationEntry[]> {
    const records = await this.shipments.list({
      customerId,
      shippedFrom: from,
      shippedTo: to,
      limit: 1000,
    })

    return records
      .filter((record) => record.shippedAt !== null)
      // 无偿补发的那一票不计入发货列：原发货已经收过一次钱了，
      // 「补发不另收费」（业务规格第 8 章）再计一次等于向客户重复收费。
      .filter((record) => record.replacesReturnId === null)
      .flatMap((record) =>
        record.lines.map((line) => ({
          occurredAt: record.shippedAt as Date,
          type: 'SHIPMENT' as const,
          docNo: record.docNo,
          productName: line.productName,
          quantity: line.shippedQty,
          amountMinor: lineAmountMinor(line),
          remark: null,
        })),
      )
  }

  async collect(customerId: string, from: Date, to: Date): Promise<AggregationEntry[]> {
    const [shipments, invoices, returns, receipts] = await Promise.all([
      this.shipmentEntries(customerId, from, to),
      this.registry.invoicesInPeriod(customerId, from, to),
      this.registry.returnsInPeriod(customerId, from, to),
      this.receipts.receiptsInPeriod(customerId, from, to),
    ])

    return [
      ...shipments,
      ...invoices.map((entry) => ({ ...entry, type: 'INVOICE' as const })),
      // 退货来源逐条自带类型：退款算 RETURN，让步接收算 ALLOWANCE。
      // 全部压成 RETURN 的话，客户会在对账单上看到一笔他手里明明还有货的「退货」。
      ...returns.map(({ lineType, ...entry }) => ({ ...entry, type: lineType })),
      ...receipts.map((entry) => ({
        occurredAt: entry.occurredAt,
        type: 'RECEIPT' as const,
        docNo: entry.docNo,
        productName: null,
        quantity: null,
        amountMinor: entry.amountMinor,
        remark: entry.remark,
      })),
    ]
  }

  openingBalance(customerId: string, asOf: Date): Promise<bigint> {
    return this.sources.openingBalance(customerId, asOf)
  }

  overdue(customerId: string): Promise<bigint> {
    return this.receipts.overdueForCustomer(customerId)
  }
}
