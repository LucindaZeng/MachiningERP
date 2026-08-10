import { Injectable } from '@nestjs/common'

import { SalesOrderService } from '../../contract-order'
import { UserDirectoryService } from '../../identity'
import { CustomerService } from '../../masterdata'

import type { ShipmentNaming } from './shipment-view.mapper'
import type { PaymentTerm } from '@prisma/client'

/** 出货校验要用到的订单事实：行数量与单价来自订单，不由出货单自说自话。 */
export interface OrderLineFacts {
  orderLineId: string
  orderedQty: string
  unitPriceMinor: bigint
}

export interface ShipmentOrderContext {
  orderId: string
  orderNo: string
  currency: string
  lines: OrderLineFacts[]
}

export interface ShipmentCustomerContext {
  customerCode: string
  customerName: string
  paymentTerm: PaymentTerm
  /** 客户档案上的结算币种，对账单以此计价 */
  currency: string
}

/**
 * 跨模块取数的唯一入口。
 *
 * 订单走 contract-order 的 `SalesOrderService`、客户走 masterdata 的
 * `CustomerService.profileFor`、业务员姓名走 identity 的 `UserDirectoryService`——
 * 三者都是对方 index.ts 上的公开出口，本模块不 import 任何对方内部文件。
 */
@Injectable()
export class ShipmentContextService {
  constructor(
    private readonly orders: SalesOrderService,
    private readonly customers: CustomerService,
    private readonly users: UserDirectoryService,
  ) {}

  async orderContext(orderId: string): Promise<ShipmentOrderContext> {
    const order = await this.orders.load(orderId)
    return {
      orderId: order.id,
      orderNo: order.docNo,
      currency: order.currency,
      lines: order.lines.map((line) => ({
        orderLineId: line.id,
        orderedQty: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
      })),
    }
  }

  async customerContext(customerId: string): Promise<ShipmentCustomerContext> {
    const profile = await this.customers.profileFor(customerId)
    return {
      customerCode: profile.code,
      customerName: profile.name,
      paymentTerm: profile.paymentTerm,
      currency: profile.currency,
    }
  }

  /** 查不到姓名时退回工号本身——宁可显示工号，也不要显示空白。 */
  async displayName(userCode: string): Promise<string> {
    const user = await this.users.findByUserCode(userCode)
    return user?.displayName ?? userCode
  }

  async namingFor(
    orderId: string,
    customerId: string,
    ownerUserCode: string,
  ): Promise<ShipmentNaming> {
    const [order, customer, ownerName] = await Promise.all([
      this.orderContext(orderId),
      this.customerContext(customerId),
      this.displayName(ownerUserCode),
    ])

    return { orderNo: order.orderNo, customerName: customer.customerName, ownerName }
  }
}
