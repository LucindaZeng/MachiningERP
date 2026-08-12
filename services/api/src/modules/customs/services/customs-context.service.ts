import { Injectable } from '@nestjs/common'

import { SalesOrderService } from '../../contract-order'
import { UserDirectoryService } from '../../identity'
import { CustomerService } from '../../masterdata'
import { ShipmentService, hasLeftFactory } from '../../shipment'

import type { CustomsNaming } from './customs-view.mapper'

/** 出具文件时要用到的出货事实。 */
export interface CustomsShipmentContext {
  shipmentId: string
  shipmentNo: string
  orderId: string
  customerId: string
  currency: string
  /** 是否已实际发出——商业发票与装箱单按实发数开，这条决定它们能不能生成 */
  posted: boolean
  quantity: string
  productName: string
  drawingNo: string
}

/**
 * 跨模块取数的唯一入口。
 *
 * 出货走 shipment 的 `ShipmentService`、订单走 contract-order、客户走 masterdata、
 * 业务员姓名走 identity——四者都是对方 index.ts 上的公开出口，
 * 本模块不 import 任何对方内部文件。
 */
@Injectable()
export class CustomsContextService {
  constructor(
    private readonly shipments: ShipmentService,
    private readonly orders: SalesOrderService,
    private readonly customers: CustomerService,
    private readonly users: UserDirectoryService,
  ) {}

  async shipmentContext(shipmentId: string): Promise<CustomsShipmentContext> {
    const shipment = await this.shipments.load(shipmentId)
    const first = shipment.lines[0]

    return {
      shipmentId: shipment.id,
      shipmentNo: shipment.docNo,
      orderId: shipment.orderId,
      customerId: shipment.customerId,
      currency: shipment.currency,
      // 「已离厂」与对账单计发货列用的是同一个判据，两处不该各有一套
      posted: hasLeftFactory(shipment.status),
      quantity: shipment.lines.reduce((sum, line) => sum + Number(line.shippedQty), 0).toFixed(6),
      productName: first?.productName ?? '',
      drawingNo: first?.drawingNo ?? '',
    }
  }

  /** 查不到姓名时退回工号本身——宁可显示工号，也不要显示空白。 */
  async displayName(userCode: string): Promise<string> {
    const user = await this.users.findByUserCode(userCode)
    return user?.displayName ?? userCode
  }

  async namingFor(
    shipmentId: string,
    orderId: string,
    customerId: string,
    ownerUserCode: string,
  ): Promise<CustomsNaming> {
    const [shipment, order, customer, ownerName] = await Promise.all([
      this.shipments.load(shipmentId),
      this.orders.load(orderId),
      this.customers.profileFor(customerId),
      this.displayName(ownerUserCode),
    ])

    return {
      shipmentNo: shipment.docNo,
      orderNo: order.docNo,
      customerName: customer.name,
      ownerName,
    }
  }
}
