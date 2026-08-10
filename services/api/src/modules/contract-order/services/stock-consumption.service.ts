import { ORDER_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import {
  SALES_ORDER_REPOSITORY,
  type SalesOrderRepositoryPort,
  type StockPrepAvailability,
} from '../repositories/sales-order.repository.port'
import {
  STOCK_CONSUMPTION_REPOSITORY,
  type StockConsumptionRecord,
  type StockConsumptionRepositoryPort,
} from '../repositories/stock-consumption.repository.port'

import { SalesOrderService, type OrderActor } from './sales-order.service'
import { blendStockCost } from './stock-blend'

export interface ConsumeStockInput {
  /** 领用方：正式订单的产品行 */
  orderLineId: string
  /** 被领用的备料订单 */
  stockOrderId: string
  /** 订单行数量 */
  orderQty: string
  /** 本单新投产的单件成本 */
  produceUnitCostMinor: bigint
}

/**
 * 备料领用（业务规格 4.5）。
 *
 * > 正式订单需求优先消耗备料库存，**直到备料产品被用完**，不足部分由正式订单继续生产。
 * > 备料剩余数量与被哪张正式订单消耗的履历全程可查。
 *
 * 加权平均成本的算式在 `stock-blend.ts` 里，是纯函数、已按规格原例钉死；
 * 这里只负责「查可领用量 → 算 → 落履历」，不重复实现算式。
 */
@Injectable()
export class StockConsumptionService {
  constructor(
    private readonly audit: AuditService,
    @Inject(SALES_ORDER_REPOSITORY) private readonly orders: SalesOrderRepositoryPort,
    @Inject(STOCK_CONSUMPTION_REPOSITORY)
    private readonly consumptions: StockConsumptionRepositoryPort,
  ) {}

  /** 按图号列出可领用的备料单，供建单界面选择。 */
  listAvailable(drawingNo: string): Promise<StockPrepAvailability[]> {
    return this.orders.findStockPrepAvailability(drawingNo)
  }

  async consume(input: ConsumeStockInput, actor: OrderActor): Promise<StockConsumptionRecord> {
    SalesOrderService.assertSales(actor)

    const stock = await this.orders.findStockPrepById(input.stockOrderId)
    if (!stock) throw new BizError(ORDER_ERRORS.ORDER_NOT_FOUND, { message: '备料订单不存在' })

    // 备料必须已完工入库才能被领用——生产中的备料还不是库存
    if (stock.stockStatus !== 'STOCKED') {
      throw new BizError(ORDER_ERRORS.STOCK_PREP_NOT_READY)
    }

    const blended = blendStockCost({
      orderQty: input.orderQty,
      availableQty: stock.availableQty,
      stockUnitCostMinor: stock.unitCostMinor,
      produceUnitCostMinor: input.produceUnitCostMinor,
    })

    if (blended.consumedQty === '0') {
      throw new BizError(ORDER_ERRORS.STOCK_PREP_EXHAUSTED, {
        message: `备料订单 ${stock.docNo} 已无可领用数量`,
      })
    }

    const record = await this.consumptions.create({
      stockOrderId: stock.orderId,
      orderLineId: input.orderLineId,
      consumedQty: blended.consumedQty,
      stockUnitCostMinor: stock.unitCostMinor,
      produceQty: blended.produceQty,
      produceUnitCostMinor: input.produceUnitCostMinor,
      blendedUnitCostMinor: blended.blendedUnitCostMinor,
      currency: stock.currency,
      createdBy: actor.userCode,
    })
    if (!record) {
      throw new BizError(ORDER_ERRORS.STOCK_PREP_EXHAUSTED, {
        message: '该订单行已经领用过这张备料单，请先解除后重试',
      })
    }

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'stock-prep.consume',
      entityType: 'StockConsumption',
      entityId: stock.docNo,
      after: {
        consumedQty: blended.consumedQty,
        produceQty: blended.produceQty,
        blendedUnitCostMinor: blended.blendedUnitCostMinor.toString(),
      },
    })

    return record
  }

  /** 某张备料单被谁领用过——履历全程可查。 */
  history(stockOrderId: string): Promise<StockConsumptionRecord[]> {
    return this.consumptions.listByStockOrder(stockOrderId)
  }

  /** 解除领用（订单行改数量或取消时）。 */
  async release(orderLineId: string, actor: OrderActor): Promise<void> {
    SalesOrderService.assertSales(actor)
    await this.consumptions.deleteByOrderLine(orderLineId)

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'stock-prep.release',
      entityType: 'StockConsumption',
      entityId: orderLineId,
    })
  }
}
