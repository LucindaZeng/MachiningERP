export interface StockConsumptionRecord {
  id: string
  stockOrderId: string
  orderLineId: string
  consumedQty: string
  stockUnitCostMinor: bigint
  produceQty: string
  produceUnitCostMinor: bigint
  blendedUnitCostMinor: bigint
  currency: string
  createdAt: Date
}

export type CreateStockConsumptionData = Omit<StockConsumptionRecord, 'id' | 'createdAt'> & {
  createdBy: string
}

export interface StockConsumptionRepositoryPort {
  /** 某张备料单被哪些正式订单领用过——「履历全程可查」（业务规格 4.5） */
  listByStockOrder(stockOrderId: string): Promise<StockConsumptionRecord[]>
  listByOrderLine(orderLineId: string): Promise<StockConsumptionRecord[]>
  /** 同一订单行对同一备料单只允许一条记录，重复领用返回 null */
  create(data: CreateStockConsumptionData): Promise<StockConsumptionRecord | null>
  deleteByOrderLine(orderLineId: string): Promise<void>
}

export const STOCK_CONSUMPTION_REPOSITORY = Symbol('STOCK_CONSUMPTION_REPOSITORY')
