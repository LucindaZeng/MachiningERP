import { blendStockCost, remainingAfter } from '../services/stock-blend'

import type {
  CreateOrderChangeRequestData,
  HandleOrderChangeData,
  OrderChangeRequestRecord,
  OrderChangeRequestRepositoryPort,
} from '../repositories/order-change-request.repository.port'
import type {
  OrderTrackingRepositoryPort,
  TrackingNodeDraft,
  TrackingNodeProgressPatch,
  TrackingNodeRecord,
} from '../repositories/order-tracking.repository.port'
import type {
  CreateSalesOrderData,
  SalesOrderHeaderDraft,
  SalesOrderLineDraft,
  SalesOrderQuery,
  SalesOrderRecord,
  SalesOrderRepositoryPort,
  SalesOrderStatusPatch,
  StockPrepAvailability,
} from '../repositories/sales-order.repository.port'
import type {
  CreateStockConsumptionData,
  StockConsumptionRecord,
  StockConsumptionRepositoryPort,
} from '../repositories/stock-consumption.repository.port'
import type { StockPrepStatus } from '@prisma/client'

let seq = 0
const nextId = (prefix: string): string => `${prefix}${(seq += 1)}`

/**
 * 假仓储一律**返回拷贝**。把内部对象引用直接交出去会让后续写入「穿透」到
 * 调用方早先拿到的快照上，乐观锁的测试就成了假绿——报价模块踩过一次。
 */
function clone(record: SalesOrderRecord): SalesOrderRecord {
  return { ...record, lines: record.lines.map((line) => ({ ...line })) }
}

export class FakeSalesOrderRepository implements SalesOrderRepositoryPort {
  readonly rows: SalesOrderRecord[] = []
  /** 备料单件成本，测试里直接设定 */
  readonly stockUnitCosts = new Map<string, bigint>()

  constructor(private readonly consumptions?: FakeStockConsumptionRepository) {}

  async findById(id: string): Promise<SalesOrderRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    return row ? clone(row) : null
  }

  async list(query: SalesOrderQuery): Promise<SalesOrderRecord[]> {
    return this.rows
      .filter((row) => !query.customerId || row.customerId === query.customerId)
      .filter((row) => !query.orderType || row.orderType === query.orderType)
      .filter((row) => !query.status || row.status === query.status)
      .slice(0, query.limit)
      .map(clone)
  }

  async create(data: CreateSalesOrderData): Promise<SalesOrderRecord> {
    const { lines, docNo, createdBy, ...header } = data
    const record: SalesOrderRecord = {
      ...header,
      id: nextId('SO'),
      docNo,
      status: 'DRAFT',
      submittedAt: null,
      submittedBy: null,
      approvedAt: null,
      rejectReason: null,
      stockedQty: null,
      stockStatus: header.orderType === 'STOCK_PREP' ? 'PRODUCING' : null,
      lines: lines.map((line) => ({ ...line, id: nextId('SOL') })),
      createdBy,
      versionLock: 0,
    }
    this.rows.push(record)
    return clone(record)
  }

  async replaceLines(
    id: string,
    versionLock: number,
    header: SalesOrderHeaderDraft,
    lines: SalesOrderLineDraft[],
  ): Promise<SalesOrderRecord | null> {
    const row = this.rows.find(
      (item) => item.id === id && item.versionLock === versionLock && item.status === 'DRAFT',
    )
    if (!row) return null

    Object.assign(row, header)
    row.lines = lines.map((line) => ({ ...line, id: nextId('SOL') }))
    row.versionLock += 1
    return clone(row)
  }

  async updateStatus(
    id: string,
    versionLock: number,
    patch: SalesOrderStatusPatch,
  ): Promise<SalesOrderRecord | null> {
    const row = this.rows.find((item) => item.id === id && item.versionLock === versionLock)
    if (!row) return null

    row.status = patch.status
    if (patch.submittedAt !== undefined) row.submittedAt = patch.submittedAt
    if (patch.submittedBy !== undefined) row.submittedBy = patch.submittedBy
    if (patch.approvedAt !== undefined) row.approvedAt = patch.approvedAt
    if (patch.rejectReason !== undefined) row.rejectReason = patch.rejectReason
    row.versionLock += 1
    return clone(row)
  }

  async setCustomerPoFile(id: string, objectKey: string): Promise<void> {
    const row = this.rows.find((item) => item.id === id)
    if (row) row.customerPoFile = objectKey
  }

  async recordStockIn(id: string, stockedQty: string, status: StockPrepStatus): Promise<void> {
    const row = this.rows.find((item) => item.id === id)
    if (!row) return
    row.stockedQty = stockedQty
    row.stockStatus = status
  }

  async findStockPrepAvailability(drawingNo: string): Promise<StockPrepAvailability[]> {
    return this.rows
      .filter((row) => row.orderType === 'STOCK_PREP')
      .filter((row) => row.lines.some((line) => line.drawingNo === drawingNo))
      .map((row) => this.toAvailability(row))
  }

  async findStockPrepById(id: string): Promise<StockPrepAvailability | null> {
    const row = this.rows.find((item) => item.id === id && item.orderType === 'STOCK_PREP')
    return row ? this.toAvailability(row) : null
  }

  private toAvailability(row: SalesOrderRecord): StockPrepAvailability {
    const total = row.lines.reduce((sum, line) => sum + Number(line.quantity), 0).toString()
    const consumed = (this.consumptions?.consumedOf(row.id) ?? '0')

    return {
      orderId: row.id,
      docNo: row.docNo,
      drawingNo: row.lines[0]?.drawingNo ?? '',
      totalQty: total,
      consumedQty: consumed,
      availableQty: remainingAfter(total, consumed),
      unitCostMinor: this.stockUnitCosts.get(row.id) ?? 1_000n,
      currency: row.currency,
      stockStatus: row.stockStatus,
    }
  }
}

export class FakeStockConsumptionRepository implements StockConsumptionRepositoryPort {
  readonly rows: StockConsumptionRecord[] = []

  async listByStockOrder(stockOrderId: string): Promise<StockConsumptionRecord[]> {
    return this.rows.filter((row) => row.stockOrderId === stockOrderId).map((row) => ({ ...row }))
  }

  async listByOrderLine(orderLineId: string): Promise<StockConsumptionRecord[]> {
    return this.rows.filter((row) => row.orderLineId === orderLineId).map((row) => ({ ...row }))
  }

  async create(data: CreateStockConsumptionData): Promise<StockConsumptionRecord | null> {
    const duplicate = this.rows.some(
      (row) => row.orderLineId === data.orderLineId && row.stockOrderId === data.stockOrderId,
    )
    if (duplicate) return null

    const { createdBy: _createdBy, ...rest } = data
    const record: StockConsumptionRecord = {
      ...rest,
      id: nextId('SC'),
      createdAt: new Date('2026-08-09T00:00:00Z'),
    }
    this.rows.push(record)
    return { ...record }
  }

  async deleteByOrderLine(orderLineId: string): Promise<void> {
    for (let index = this.rows.length - 1; index >= 0; index -= 1) {
      if (this.rows[index]?.orderLineId === orderLineId) this.rows.splice(index, 1)
    }
  }

  /** 某张备料单已被领用的总量，供可领用量计算 */
  consumedOf(stockOrderId: string): string {
    const total = this.rows
      .filter((row) => row.stockOrderId === stockOrderId)
      .reduce((sum, row) => sum + Number(row.consumedQty), 0)
    return total.toString()
  }
}

/** 领用后的可领用量：给可读性更好的断言用 */
export function availableAfter(total: string, consumed: string): string {
  return blendStockCost({
    orderQty: total,
    availableQty: remainingAfter(total, consumed),
    stockUnitCostMinor: 0n,
    produceUnitCostMinor: 0n,
  }).consumedQty
}

export class FakeOrderChangeRequestRepository implements OrderChangeRequestRepositoryPort {
  readonly rows: OrderChangeRequestRecord[] = []

  async findById(id: string): Promise<OrderChangeRequestRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    return row ? { ...row } : null
  }

  async listByOrder(orderId: string): Promise<OrderChangeRequestRecord[]> {
    return this.rows.filter((row) => row.orderId === orderId).map((row) => ({ ...row }))
  }

  async create(data: CreateOrderChangeRequestData): Promise<OrderChangeRequestRecord> {
    const record: OrderChangeRequestRecord = {
      ...data,
      id: nextId('OCR'),
      status: 'SUBMITTED',
      submittedAt: new Date('2026-08-09T02:00:00Z'),
      handledBy: null,
      handledAt: null,
      rejectReason: null,
      versionLock: 0,
    }
    this.rows.push(record)
    return { ...record }
  }

  async handle(
    id: string,
    versionLock: number,
    data: HandleOrderChangeData,
  ): Promise<OrderChangeRequestRecord | null> {
    const row = this.rows.find(
      (item) => item.id === id && item.versionLock === versionLock && item.status === 'SUBMITTED',
    )
    if (!row) return null

    row.status = data.status
    row.handledBy = data.handledBy
    row.handledAt = data.handledAt
    row.rejectReason = data.rejectReason ?? null
    row.versionLock += 1
    return { ...row }
  }
}

export class FakeOrderTrackingRepository implements OrderTrackingRepositoryPort {
  readonly rows: TrackingNodeRecord[] = []

  async listByOrderLine(orderLineId: string): Promise<TrackingNodeRecord[]> {
    return this.rows
      .filter((row) => row.orderLineId === orderLineId)
      .sort((left, right) => left.sequence - right.sequence)
      .map((row) => ({ ...row }))
  }

  async listByOrder(): Promise<Map<string, TrackingNodeRecord[]>> {
    const grouped = new Map<string, TrackingNodeRecord[]>()
    for (const row of this.rows) {
      const list = grouped.get(row.orderLineId) ?? []
      list.push({ ...row })
      grouped.set(row.orderLineId, list)
    }
    return grouped
  }

  async replaceNodes(
    orderLineId: string,
    nodes: TrackingNodeDraft[],
  ): Promise<TrackingNodeRecord[]> {
    for (let index = this.rows.length - 1; index >= 0; index -= 1) {
      if (this.rows[index]?.orderLineId === orderLineId) this.rows.splice(index, 1)
    }
    this.rows.push(...nodes.map((node) => ({ ...node, id: nextId('TN') })))
    return this.listByOrderLine(orderLineId)
  }

  async findNode(orderLineId: string, sequence: number): Promise<TrackingNodeRecord | null> {
    const row = this.rows.find(
      (item) => item.orderLineId === orderLineId && item.sequence === sequence,
    )
    return row ? { ...row } : null
  }

  async updateNode(
    id: string,
    patch: TrackingNodeProgressPatch,
  ): Promise<TrackingNodeRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    if (!row) return null

    Object.assign(row, patch)
    return { ...row }
  }
}
