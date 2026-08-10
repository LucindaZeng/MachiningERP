import { Injectable } from '@nestjs/common'

import { SalesOrderService } from '../../contract-order'
import { UserDirectoryService } from '../../identity'
import { CustomerService } from '../../masterdata'
import { ShipmentService } from '../../shipment'

import type { ReturnNaming } from './return-view.mapper'

/** 退货数量校验要用的出货事实：能退多少，由**原出货行的实发数**说了算。 */
export interface ShippedLineFacts {
  shipmentLineId: string
  orderLineId: string
  productName: string
  drawingNo: string
  batchNo: string
  shippedQty: string
  unitPriceMinor: bigint
}

export interface ReturnShipmentContext {
  shipmentId: string
  shipmentNo: string
  orderId: string
  customerId: string
  currency: string
  lines: ShippedLineFacts[]
}

/**
 * 跨模块取数的唯一入口。
 *
 * 出货走 shipment 的 `ShipmentService`、客户走 masterdata 的 `CustomerService`、
 * 业务员姓名走 identity 的 `UserDirectoryService`——三者都是对方 index.ts 上的
 * 公开出口，本模块不 import 任何对方内部文件。
 *
 * 订单号从出货单带出而不是再去问 contract-order：退货必然挂在某一票出货上，
 * 那票出货已经知道自己属于哪张订单，多跳一个模块只会多一处可能不一致的地方。
 */
@Injectable()
export class ReturnContextService {
  constructor(
    private readonly shipments: ShipmentService,
    private readonly orders: SalesOrderService,
    private readonly customers: CustomerService,
    private readonly users: UserDirectoryService,
  ) {}

  async shipmentContext(shipmentId: string): Promise<ReturnShipmentContext> {
    const shipment = await this.shipments.load(shipmentId)
    return {
      shipmentId: shipment.id,
      shipmentNo: shipment.docNo,
      orderId: shipment.orderId,
      customerId: shipment.customerId,
      currency: shipment.currency,
      lines: shipment.lines.map((line) => ({
        shipmentLineId: line.id,
        orderLineId: line.orderLineId,
        productName: line.productName,
        drawingNo: line.drawingNo,
        batchNo: line.batchNo,
        shippedQty: line.shippedQty,
        unitPriceMinor: line.unitPriceMinor,
      })),
    }
  }

  async customerName(customerId: string): Promise<string> {
    const profile = await this.customers.profileFor(customerId)
    return profile.name
  }

  /** 查不到姓名时退回工号本身——宁可显示工号，也不要显示空白。 */
  async displayName(userCode: string): Promise<string> {
    const user = await this.users.findByUserCode(userCode)
    return user?.displayName ?? userCode
  }

  async namingFor(
    customerId: string,
    ownerUserCode: string,
    shipmentId: string | null,
    orderId: string,
  ): Promise<ReturnNaming> {
    const [customerName, ownerName, shipmentNo, order] = await Promise.all([
      this.customerName(customerId),
      this.displayName(ownerUserCode),
      this.shipmentNoOf(shipmentId),
      this.orders.load(orderId),
    ])

    return { customerName, ownerName, shipmentNo, orderNo: order.docNo }
  }

  /** 出货单号；无出货关联（少见但合法：直发样件的客诉）时返回占位符。 */
  private async shipmentNoOf(shipmentId: string | null): Promise<string> {
    if (!shipmentId) return '—'
    const shipment = await this.shipments.load(shipmentId)
    return shipment.docNo
  }
}
