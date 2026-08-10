import type { ShipmentStatus, TailPlan } from '@prisma/client'

export interface ShipmentLineRecord {
  id: string
  sequence: number
  orderLineId: string
  productName: string
  drawingNo: string
  itemCode: string | null
  batchNo: string
  /** 数量一律 decimal 字符串，禁止浮点 */
  orderedQty: string
  qualifiedQty: string
  packedQty: string
  shippedQty: string
  unitPriceMinor: bigint
  tailPlan: TailPlan | null
  tailResolvedQty: string
  tailApprovedBy: string | null
  tailApprovedAt: Date | null
  tailRemark: string | null
}

export interface ShipmentRecord {
  id: string
  docNo: string
  orderId: string
  customerId: string
  deliveryAddressId: string | null
  currency: string
  carrier: string | null
  trackingNo: string | null
  invoiceNo: string | null
  /** 无偿补发标记：非空表示这一票是为某张 RMA 补货的，不计入对账单发货列 */
  replacesReturnId: string | null
  status: ShipmentStatus
  ownerUserCode: string
  packedAt: Date | null
  shippedAt: Date | null
  signedAt: Date | null
  invoicedAt: Date | null
  closedAt: Date | null
  lines: ShipmentLineRecord[]
  versionLock: number
}

export type ShipmentLineDraft = Omit<
  ShipmentLineRecord,
  'id' | 'tailPlan' | 'tailResolvedQty' | 'tailApprovedBy' | 'tailApprovedAt' | 'tailRemark'
>

export interface ShipmentHeaderDraft {
  orderId: string
  customerId: string
  deliveryAddressId: string | null
  currency: string
  carrier: string | null
  trackingNo: string | null
  replacesReturnId?: string | null
  ownerUserCode: string
}

export interface CreateShipmentData extends ShipmentHeaderDraft {
  docNo: string
  createdBy: string
  lines: ShipmentLineDraft[]
}

/** 状态推进补丁；时间戳由服务层按迁移目标填，repository 不做业务判断。 */
export interface ShipmentPatch {
  status?: ShipmentStatus
  carrier?: string | null
  trackingNo?: string | null
  invoiceNo?: string | null
  packedAt?: Date | null
  shippedAt?: Date | null
  signedAt?: Date | null
  invoicedAt?: Date | null
  closedAt?: Date | null
  updatedBy: string
}

/**
 * 尾数处置写回：按行落 plan 与已结清数量。
 * 顺带带上行快照（订单行、图号、批次），返工事件因此不必回头反查明细。
 */
export interface TailResolution {
  lineId: string
  orderLineId: string
  drawingNo: string
  batchNo: string
  tailPlan: TailPlan
  tailResolvedQty: string
  tailApprovedBy: string
  tailApprovedAt: Date
  tailRemark: string | null
}

export interface ShipmentQuery {
  customerId?: string
  orderId?: string
  status?: ShipmentStatus
  ownerUserCode?: string
  shippedFrom?: Date
  shippedTo?: Date
  limit: number
}

export interface ShipmentRepositoryPort {
  findById(id: string): Promise<ShipmentRecord | null>
  findByDocNo(docNo: string): Promise<ShipmentRecord | null>
  list(query: ShipmentQuery): Promise<ShipmentRecord[]>
  create(data: CreateShipmentData): Promise<ShipmentRecord>
  /** 带乐观锁的状态推进；版本冲突返回 null */
  patch(id: string, versionLock: number, patch: ShipmentPatch): Promise<ShipmentRecord | null>
  applyTailResolutions(
    id: string,
    versionLock: number,
    resolutions: readonly TailResolution[],
    updatedBy: string,
  ): Promise<ShipmentRecord | null>
  /** 某订单行已经发出去的累计数量：订单状态回写（部分/全部出货）要用 */
  sumShippedByOrderLine(orderLineIds: readonly string[]): Promise<Record<string, string>>
}

export const SHIPMENT_REPOSITORY = Symbol('SHIPMENT_REPOSITORY')
