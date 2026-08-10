import { Injectable } from '@nestjs/common'

import { CustomerService } from '../../masterdata'
import { ShipmentService, lineAmountMinor } from '../../shipment'

import type { InvoiceCustomerFacts, InvoiceLineFacts } from './invoice-autofill'

/** 客户地区枚举 → 自动带出规则认识的三档。 */
const DOMESTIC_REGION = 'DOMESTIC'

/**
 * 跨模块取数的唯一入口：客户档案走 masterdata 的公开出口，
 * 出货明细走 shipment 的公开出口。本模块不 import 对方任何内部文件。
 */
@Injectable()
export class InvoiceContextService {
  constructor(
    private readonly customers: CustomerService,
    private readonly shipments: ShipmentService,
  ) {}

  async customerFacts(customerId: string): Promise<InvoiceCustomerFacts & { name: string }> {
    const profile = await this.customers.invoiceProfileFor(customerId)

    return {
      name: profile.name,
      region: profile.region === DOMESTIC_REGION ? 'DOMESTIC' : regionOf(profile.region),
      invoiceType: profile.invoiceType === 'SPECIAL' ? 'SPECIAL' : 'GENERAL',
      title: profile.name,
      taxNo: profile.taxNo,
      bankAccount: profile.bankAccount,
      invoiceAddress: profile.invoiceAddress,
      ownerEmail: profile.ownerEmail,
      paymentTerm: profile.paymentTerm,
      currency: profile.currency,
    }
  }

  /**
   * 把出货单摊平成发票明细。金额口径与出货单一致（行发货数 × 单价），
   * 两边各算一次迟早会算出两个答案——所以直接用 shipment 导出的那支函数。
   */
  async linesFromShipments(shipmentIds: readonly string[]): Promise<InvoiceLineFacts[]> {
    const records = await Promise.all(shipmentIds.map((id) => this.shipments.load(id)))

    return records.flatMap((shipment) =>
      shipment.lines.map((line) => ({
        shipmentId: shipment.id,
        shipmentNo: shipment.docNo,
        productName: line.productName,
        drawingNo: line.drawingNo,
        quantity: line.shippedQty,
        unitPriceMinor: line.unitPriceMinor,
        amountMinor: lineAmountMinor(line),
      })),
    )
  }

  /** 引用出货单的金额合计，供三方一致性比对。 */
  async shipmentTotalOf(shipmentIds: readonly string[]): Promise<bigint> {
    const lines = await this.linesFromShipments(shipmentIds)
    return lines.reduce((sum, line) => sum + line.amountMinor, 0n)
  }
}

/** 港澳台与国外在开票上是一回事：都开出口票。 */
function regionOf(region: string): 'HK_MO_TW' | 'OVERSEAS' {
  return region === 'HK_MO_TW' ? 'HK_MO_TW' : 'OVERSEAS'
}
