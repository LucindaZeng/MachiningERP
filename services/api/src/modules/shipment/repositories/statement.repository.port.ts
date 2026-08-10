import type { StatementLineType, StatementStatus } from '@prisma/client'

export interface StatementLineRecord {
  id: string
  sequence: number
  occurredAt: Date
  type: StatementLineType
  docNo: string
  productName: string | null
  quantity: string | null
  /** 回款与退货折让为负数，直接相加即得期末余额 */
  amountMinor: bigint
  matched: boolean
  remark: string | null
}

export interface StatementRecord {
  id: string
  docNo: string
  customerId: string
  periodFrom: Date
  periodTo: Date
  currency: string
  version: number
  openingBalanceMinor: bigint
  shippedAmountMinor: bigint
  invoicedAmountMinor: bigint
  receivedAmountMinor: bigint
  returnAmountMinor: bigint
  closingBalanceMinor: bigint
  differenceAmountMinor: bigint
  differenceNote: string | null
  overdueAmountMinor: bigint
  status: StatementStatus
  ownerUserCode: string
  sentAt: Date | null
  confirmedAt: Date | null
  lines: StatementLineRecord[]
  versionLock: number
}

export type StatementLineDraft = Omit<StatementLineRecord, 'id'>

export interface CreateStatementData {
  docNo: string
  customerId: string
  periodFrom: Date
  periodTo: Date
  currency: string
  version: number
  openingBalanceMinor: bigint
  shippedAmountMinor: bigint
  invoicedAmountMinor: bigint
  receivedAmountMinor: bigint
  returnAmountMinor: bigint
  closingBalanceMinor: bigint
  differenceAmountMinor: bigint
  differenceNote: string | null
  overdueAmountMinor: bigint
  ownerUserCode: string
  createdBy: string
  lines: StatementLineDraft[]
}

export interface StatementPatch {
  status?: StatementStatus
  sentAt?: Date | null
  confirmedAt?: Date | null
  differenceNote?: string | null
  updatedBy: string
}

export interface StatementQuery {
  customerId?: string
  status?: StatementStatus
  /** 只看每个客户+期间的最新版本，默认 false（列全部版本） */
  latestOnly?: boolean
  limit: number
}

export interface StatementRepositoryPort {
  findById(id: string): Promise<StatementRecord | null>
  list(query: StatementQuery): Promise<StatementRecord[]>
  create(data: CreateStatementData): Promise<StatementRecord>
  patch(id: string, versionLock: number, patch: StatementPatch): Promise<StatementRecord | null>
  /** 客户核对状态是对账单上唯一允许人工改的字段 */
  setLineMatched(statementId: string, lineId: string, matched: boolean): Promise<boolean>
  /** 同一客户同一期间已有的最大版本号；没有则 0 */
  latestVersion(customerId: string, periodFrom: Date, periodTo: Date): Promise<number>
}

export const STATEMENT_REPOSITORY = Symbol('STATEMENT_REPOSITORY')
