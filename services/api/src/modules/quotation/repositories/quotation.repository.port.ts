import type { QuotationTerms } from '../constants/quotation-terms'
import type { QuotationStatus } from '@prisma/client'

export interface QuotationTierRecord {
  id: string
  /** 起订量，decimal 字符串 */
  minQuantity: string
  /** 业务员填入的最终报价 */
  unitPriceMinor: bigint
  /**
   * 该档的单件成本快照。**由后端从成本分析推导后落库**，不接受前端传入——
   * 否则「低于成本价」这道拦截就形同虚设。
   */
  unitCostMinor: bigint
  label: string | null
}

export interface QuotationItemRecord {
  id: string
  sequence: number
  productName: string
  drawingNo: string
  drawingVersionId: string | null
  revision: string | null
  material: string | null
  finishing: string | null
  process: string | null
  costAnalysisLineId: string | null
  remark: string | null
  tiers: QuotationTierRecord[]
}

export interface QuotationRecord {
  id: string
  docNo: string
  version: number
  rootId: string | null
  customerId: string
  costAnalysisId: string
  template: string
  currency: string
  fxRateMicros: bigint | null
  fxQuotedOn: Date | null
  /** 模具费单列，**不摊入单件价** */
  moldFeeMinor: bigint
  terms: QuotationTerms | null
  status: QuotationStatus
  validUntil: Date | null
  submittedBy: string | null
  submittedAt: Date | null
  approvedBy: string | null
  approvedAt: Date | null
  rejectReason: string | null
  items: QuotationItemRecord[]
  createdBy: string | null
  versionLock: number
}

export type QuotationTierDraft = Omit<QuotationTierRecord, 'id'>
export type QuotationItemDraft = Omit<QuotationItemRecord, 'id' | 'tiers'> & {
  tiers: QuotationTierDraft[]
}

/** 表头上业务员可改的部分（不含状态与审核痕迹） */
export interface QuotationHeaderDraft {
  template: string
  currency: string
  fxRateMicros: bigint | null
  fxQuotedOn: Date | null
  moldFeeMinor: bigint
  terms: QuotationTerms | null
}

export interface CreateQuotationData extends QuotationHeaderDraft {
  docNo: string
  version: number
  rootId: string | null
  customerId: string
  costAnalysisId: string
  createdBy: string
  items: QuotationItemDraft[]
}

/** 状态迁移时一并写入的审核痕迹。undefined 表示不动，null 表示清空。 */
export interface QuotationStatusPatch {
  status: QuotationStatus
  validUntil?: Date | null
  submittedBy?: string | null
  submittedAt?: Date | null
  approvedBy?: string | null
  approvedAt?: Date | null
  rejectReason?: string | null
  updatedBy: string
}

export interface QuotationRepositoryPort {
  findById(id: string): Promise<QuotationRecord | null>
  listByCustomer(customerId: string, limit: number): Promise<QuotationRecord[]>
  create(data: CreateQuotationData): Promise<QuotationRecord>
  /** 带乐观锁的整单替换（表头 + 明细 + 阶梯）；版本冲突返回 null */
  replaceItems(
    id: string,
    versionLock: number,
    header: QuotationHeaderDraft,
    items: QuotationItemDraft[],
    updatedBy: string,
  ): Promise<QuotationRecord | null>
  /** 带乐观锁的状态迁移；版本冲突返回 null */
  updateStatus(
    id: string,
    versionLock: number,
    patch: QuotationStatusPatch,
  ): Promise<QuotationRecord | null>
}

export const QUOTATION_REPOSITORY = Symbol('QUOTATION_REPOSITORY')
