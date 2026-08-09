import type { RequestStatus } from '@prisma/client'

export type FieldValue = string | number | boolean | null

/** 单个字段的前后值快照。落库形状，因此定义在仓储端口而不是 services。 */
export interface FieldChange {
  field: string
  label: string
  before: FieldValue
  after: FieldValue
}


export interface CustomerChangeRequestRecord {
  id: string
  requestNo: string
  customerId: string
  changes: FieldChange[]
  reason: string
  status: RequestStatus
  submittedBy: string
  submittedAt: Date
  decidedBy: string | null
  decidedAt: Date | null
  rejectReason: string | null
  version: number
}

export interface CreateChangeRequestData {
  requestNo: string
  customerId: string
  changes: FieldChange[]
  reason: string
  submittedBy: string
}

export interface DecideChangeRequestData {
  id: string
  version: number
  status: Extract<RequestStatus, 'APPROVED' | 'REJECTED'>
  decidedBy: string
  decidedAt: Date
  rejectReason: string | null
}

export interface CustomerChangeRequestRepositoryPort {
  findById(id: string): Promise<CustomerChangeRequestRecord | null>
  listByCustomer(customerId: string, status?: RequestStatus): Promise<CustomerChangeRequestRecord[]>
  create(data: CreateChangeRequestData): Promise<CustomerChangeRequestRecord>
  /** 带乐观锁的裁决；冲突或已裁决返回 false */
  decide(data: DecideChangeRequestData): Promise<boolean>
}

export const CUSTOMER_CHANGE_REQUEST_REPOSITORY = Symbol('CUSTOMER_CHANGE_REQUEST_REPOSITORY')
