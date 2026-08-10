import { fromMinor, type CurrencyCode } from '@machining-erp/shared'

import type { StockConsumptionView } from '../dto/stock-consumption-view.dto'
import type { StockPrepAvailabilityView } from '../dto/stock-prep-view.dto'
import type { StockPrepAvailability } from '../repositories/sales-order.repository.port'
import type { StockConsumptionRecord } from '../repositories/stock-consumption.repository.port'

export function toAvailabilityView(record: StockPrepAvailability): StockPrepAvailabilityView {
  const currency = record.currency as CurrencyCode

  return {
    orderId: record.orderId,
    docNo: record.docNo,
    drawingNo: record.drawingNo,
    totalQty: record.totalQty,
    consumedQty: record.consumedQty,
    availableQty: record.availableQty,
    unitCost: fromMinor({ minor: record.unitCostMinor, currency }),
    stockStatus: record.stockStatus,
  }
}

export function toConsumptionView(record: StockConsumptionRecord): StockConsumptionView {
  const currency = record.currency as CurrencyCode

  return {
    id: record.id,
    stockOrderId: record.stockOrderId,
    orderLineId: record.orderLineId,
    consumedQty: record.consumedQty,
    produceQty: record.produceQty,
    stockUnitCost: fromMinor({ minor: record.stockUnitCostMinor, currency }),
    produceUnitCost: fromMinor({ minor: record.produceUnitCostMinor, currency }),
    blendedUnitCost: fromMinor({ minor: record.blendedUnitCostMinor, currency }),
    createdAt: record.createdAt.toISOString(),
  }
}
