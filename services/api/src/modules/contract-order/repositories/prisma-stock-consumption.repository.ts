import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreateStockConsumptionData,
  StockConsumptionRecord,
  StockConsumptionRepositoryPort,
} from './stock-consumption.repository.port'
import type { StockConsumption } from '@prisma/client'

function toRecord(row: StockConsumption): StockConsumptionRecord {
  return {
    id: row.id,
    stockOrderId: row.stockOrderId,
    orderLineId: row.orderLineId,
    consumedQty: row.consumedQty.toString(),
    stockUnitCostMinor: row.stockUnitCostMinor,
    produceQty: row.produceQty.toString(),
    produceUnitCostMinor: row.produceUnitCostMinor,
    blendedUnitCostMinor: row.blendedUnitCostMinor,
    currency: row.currency,
    createdAt: row.createdAt,
  }
}

@Injectable()
export class PrismaStockConsumptionRepository implements StockConsumptionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByStockOrder(stockOrderId: string): Promise<StockConsumptionRecord[]> {
    const rows = await this.prisma.stockConsumption.findMany({
      where: { stockOrderId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(toRecord)
  }

  async listByOrderLine(orderLineId: string): Promise<StockConsumptionRecord[]> {
    const rows = await this.prisma.stockConsumption.findMany({ where: { orderLineId } })
    return rows.map(toRecord)
  }

  /**
   * 同一订单行对同一备料单只允许一条记录（库里有唯一约束）。
   * 撞唯一键返回 null 而不是抛，让 service 用业务错误码回话。
   */
  async create(data: CreateStockConsumptionData): Promise<StockConsumptionRecord | null> {
    const { createdBy, ...rest } = data

    try {
      const row = await this.prisma.stockConsumption.create({
        data: {
          ...rest,
          consumedQty: new Prisma.Decimal(rest.consumedQty),
          produceQty: new Prisma.Decimal(rest.produceQty),
          createdBy,
        },
      })
      return toRecord(row)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null
      }
      throw error
    }
  }

  async deleteByOrderLine(orderLineId: string): Promise<void> {
    await this.prisma.stockConsumption.deleteMany({ where: { orderLineId } })
  }
}
