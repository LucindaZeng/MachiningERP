import type { LoginAudience, PasswordResetStatus } from '@prisma/client'

export interface PasswordResetRecord {
  id: string
  requestNo: string
  audience: LoginAudience
  account: string
  applicantName: string
  department: string
  contact: string
  reason: string | null
  status: PasswordResetStatus
  submittedAt: Date
}

export interface CreatePasswordResetInput {
  requestNo: string
  audience: LoginAudience
  account: string
  applicantName: string
  department: string
  contact: string
  reason: string | null
}

export interface PasswordResetRepositoryPort {
  hasPending(audience: LoginAudience, account: string): Promise<boolean>
  create(input: CreatePasswordResetInput): Promise<PasswordResetRecord>
  listPending(limit: number): Promise<PasswordResetRecord[]>
}

export const PASSWORD_RESET_REPOSITORY = Symbol('PASSWORD_RESET_REPOSITORY')
