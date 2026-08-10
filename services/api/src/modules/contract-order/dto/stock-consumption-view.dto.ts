import type { Money } from '@machining-erp/shared'

/** 备料领用履历一条：被哪张订单行领了多少、加权后单件成本是多少。 */
export interface StockConsumptionView {
  id: string
  stockOrderId: string
  orderLineId: string
  consumedQty: string
  produceQty: string
  stockUnitCost: Money
  produceUnitCost: Money
  /** 加权平均单件成本 =（备料成本×领用数 + 新产成本×新产数）÷ 订单数量 */
  blendedUnitCost: Money
  createdAt: string
}
