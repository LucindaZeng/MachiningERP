import type { RequestStatus } from '@prisma/client'

export interface AccountRequestRecord {
  id: string
  requestNo: string
  employeeName: string
  department: string
  departmentId: string | null
  account: string
  passwordHash: string
  contact: string | null
  reason: string | null
  userCode: string
  reusedFrom: string | null
  status: RequestStatus
  submittedAt: Date
  decidedAt: Date | null
  decidedBy: string | null
  rejectReason: string | null
  version: number
}

export interface CreateAccountRequestInput {
  requestNo: string
  employeeName: string
  department: string
  departmentId: string | null
  account: string
  passwordHash: string
  contact: string | null
  reason: string | null
  userCode: string
  reusedFrom: string | null
}

export interface DecideAccountRequestInput {
  id: string
  version: number
  status: Extract<RequestStatus, 'APPROVED' | 'REJECTED'>
  decidedBy: string
  decidedAt: Date
  rejectReason: string | null
  approvedUserId: string | null
}

export interface AccountRequestRepositoryPort {
  /** 待审批的申请同样占用用户名，避免两个人同时申请到同一个 */
  hasPending(account: string): Promise<boolean>
  findById(id: string): Promise<AccountRequestRecord | null>
  create(input: CreateAccountRequestInput): Promise<AccountRequestRecord>
  listByStatus(status: RequestStatus, limit: number): Promise<AccountRequestRecord[]>
  /** 带乐观锁的裁决；版本冲突返回 false */
  decide(input: DecideAccountRequestInput): Promise<boolean>
}

export const ACCOUNT_REQUEST_REPOSITORY = Symbol('ACCOUNT_REQUEST_REPOSITORY')
