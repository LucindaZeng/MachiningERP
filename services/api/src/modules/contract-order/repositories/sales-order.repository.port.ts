import type {
  ChargeMode,
  SalesOrderStatus,
  SalesOrderType,
  StockPrepStatus,
} from '@prisma/client'

export interface SalesOrderLineRecord {
  id: string
  sequence: number
  quotationId: string | null
  quotationItemId: string | null
  costAnalysisId: string | null
  productName: string
  drawingNo: string
  drawingVersionId: string | null
  revision: string | null
  itemCode: string | null
  bomRequestNo: string | null
  quantity: string
  unitPriceMinor: bigint
  deliveryDate: Date | null
  remark: string | null
}

export interface SalesOrderRecord {
  id: string
  docNo: string
  customerId: string
  orderType: SalesOrderType
  chargeMode: ChargeMode
  customerPoNo: string | null
  customerPoFile: string | null
  currency: string
  taxRateBps: number
  internalDueDate: Date | null
  costOwner: string | null
  freeReason: string | null
  estimatedCostMinor: bigint | null
  status: SalesOrderStatus
  submittedAt: Date | null
  submittedBy: string | null
  approvedAt: Date | null
  rejectReason: string | null
  /** 备料订单专用 */
  stockedQty: string | null
  stockStatus: StockPrepStatus | null
  lines: SalesOrderLineRecord[]
  createdBy: string | null
  versionLock: number
}

export type SalesOrderLineDraft = Omit<SalesOrderLineRecord, 'id'>

/** 表头上业务员可改的部分，不含状态与审批痕迹 */
export interface SalesOrderHeaderDraft {
  customerId: string
  orderType: SalesOrderType
  chargeMode: ChargeMode
  customerPoNo: string | null
  customerPoFile: string | null
  currency: string
  taxRateBps: number
  internalDueDate: Date | null
  costOwner: string | null
  freeReason: string | null
  estimatedCostMinor: bigint | null
}

export interface CreateSalesOrderData extends SalesOrderHeaderDraft {
  docNo: string
  createdBy: string
  lines: SalesOrderLineDraft[]
}

export interface SalesOrderStatusPatch {
  status: SalesOrderStatus
  submittedAt?: Date | null
  submittedBy?: string | null
  approvedAt?: Date | null
  rejectReason?: string | null
  updatedBy: string
}

export interface SalesOrderQuery {
  customerId?: string
  orderType?: SalesOrderType
  status?: SalesOrderStatus
  limit: number
}

/** 备料库存的可领用量：订单数量 − 已被领用总量；只有 STOCKED 的备料单参与。 */
export interface StockPrepAvailability {
  orderId: string
  docNo: string
  drawingNo: string
  totalQty: string
  consumedQty: string
  availableQty: string
  unitCostMinor: bigint
  currency: string
  stockStatus: StockPrepStatus | null
}

export interface SalesOrderRepositoryPort {
  findById(id: string): Promise<SalesOrderRecord | null>
  list(query: SalesOrderQuery): Promise<SalesOrderRecord[]>
  create(data: CreateSalesOrderData): Promise<SalesOrderRecord>
  /** 带乐观锁的整单替换；版本冲突或已离开草稿态返回 null */
  replaceLines(
    id: string,
    versionLock: number,
    header: SalesOrderHeaderDraft,
    lines: SalesOrderLineDraft[],
    updatedBy: string,
  ): Promise<SalesOrderRecord | null>
  updateStatus(
    id: string,
    versionLock: number,
    patch: SalesOrderStatusPatch,
  ): Promise<SalesOrderRecord | null>
  /** 回填客户订单原件的对象键。只改这一列，不动状态与版本锁 */
  setCustomerPoFile(id: string, objectKey: string, updatedBy: string): Promise<void>
  /** 备料完工入库数量登记；达到订单数量即转 STOCKED */
  recordStockIn(id: string, stockedQty: string, status: StockPrepStatus): Promise<void>
  /** 可被领用的备料单：按图号找，且必须已完工入库 */
  findStockPrepAvailability(drawingNo: string): Promise<StockPrepAvailability[]>
  findStockPrepById(id: string): Promise<StockPrepAvailability | null>
}

export const SALES_ORDER_REPOSITORY = Symbol('SALES_ORDER_REPOSITORY')
