import { Injectable } from '@nestjs/common'

import { SalesOrderService } from '../../contract-order'
import { UserDirectoryService } from '../../identity'
import { CustomerService } from '../../masterdata'
import { ShipmentService } from '../../shipment'

import type { CustomsNaming } from './customs-payload.mapper'
import type { QuotationNaming } from './quotation-payload.mapper'
import type { CustomsDossierRecord } from '../../customs'

/**
 * 跨模块取名字的唯一入口。
 *
 * 单据上印的是**人和公司的名字**，不是工号和 uuid；而这些名字散在 masterdata
 * 与 identity 里。集中在这一支的理由：出具路径有四条（报价、成本、对账、报关），
 * 各自去取一遍，迟早出现同一个客户在两份单据上一个印全称一个印简称。
 *
 * 取不到时一律**退回原始标识**（工号、id）而不是留空——
 * 客户单据上出现一片空白，比出现一个工号更难解释。
 */
@Injectable()
export class DocgenContextService {
  constructor(
    private readonly customers: CustomerService,
    private readonly users: UserDirectoryService,
    private readonly shipments: ShipmentService,
    private readonly orders: SalesOrderService,
  ) {}

  async displayName(userCode: string): Promise<string> {
    const user = await this.users.findByUserCode(userCode)
    return user?.displayName ?? userCode
  }

  async customerName(customerId: string): Promise<string> {
    try {
      return (await this.customers.profileFor(customerId)).name
    } catch {
      // 客户被停用或删档不该让历史单据出不来
      return customerId
    }
  }

  /** 报价单抬头：客户联系方式 + 业务员联系方式。 */
  async quotationNaming(customerId: string, ownerUserCode: string): Promise<QuotationNaming> {
    const [profile, owner] = await Promise.all([
      this.customers.invoiceProfileFor(customerId).catch(() => null),
      this.users.findByUserCode(ownerUserCode),
    ])

    return {
      customerName: profile?.name ?? (await this.customerName(customerId)),
      // 客户档案里目前没有联系人与电话字段，留空由业务在导出后手填
      customerContact: null,
      customerPhone: null,
      customerFax: null,
      customerEmail: profile?.ownerEmail ?? null,
      customerAddress: profile?.invoiceAddress ?? null,
      ownerName: owner?.displayName ?? ownerUserCode,
      ownerPhone: null,
      ownerEmail: null,
    }
  }

  /** 报关文件抬头：收货人、关联单号与付款方式。 */
  async customsNaming(record: CustomsDossierRecord): Promise<CustomsNaming> {
    const [profile, shipment, order] = await Promise.all([
      this.customers.invoiceProfileFor(record.customerId).catch(() => null),
      this.shipments.load(record.shipmentId).catch(() => null),
      this.orders.load(record.orderId).catch(() => null),
    ])

    return {
      customerName: profile?.name ?? record.customerId,
      customerAddress: profile?.invoiceAddress ?? '',
      shipmentNo: shipment?.docNo ?? '',
      orderNo: order?.docNo ?? '',
      paymentTerms: profile?.paymentTerm ?? '',
    }
  }
}
