import type { OrderChangeStatus, OrderChangeType } from '@prisma/client'

export interface OrderChangeRequestRecord {
  id: string
  requestNo: string
  orderId: string
  orderLineId: string | null
  changeType: OrderChangeType
  origin: string
  urgent: boolean
  beforeValue: string
  afterValue: string
  reason: string
  costOwner: string | null
  status: OrderChangeStatus
  submittedBy: string
  submittedAt: Date
  handledBy: string | null
  handledAt: Date | null
  rejectReason: string | null
  versionLock: number
}

export interface CreateOrderChangeRequestData {
  requestNo: string
  orderId: string
  orderLineId: string | null
  changeType: OrderChangeType
  origin: string
  urgent: boolean
  beforeValue: string
  afterValue: string
  reason: string
  costOwner: string | null
  submittedBy: string
}

export interface HandleOrderChangeData {
  status: OrderChangeStatus
  handledBy: string
  handledAt: Date
  rejectReason?: string | null
}

export interface OrderChangeRequestRepositoryPort {
  findById(id: string): Promise<OrderChangeRequestRecord | null>
  listByOrder(orderId: string): Promise<OrderChangeRequestRecord[]>
  create(data: CreateOrderChangeRequestData): Promise<OrderChangeRequestRecord>
  /** 带乐观锁；版本冲突或已被处理返回 null */
  handle(
    id: string,
    versionLock: number,
    data: HandleOrderChangeData,
  ): Promise<OrderChangeRequestRecord | null>
}

export const ORDER_CHANGE_REQUEST_REPOSITORY = Symbol('ORDER_CHANGE_REQUEST_REPOSITORY')
