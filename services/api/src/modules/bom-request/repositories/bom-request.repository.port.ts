import type { BomProductionType, BomRequestStatus } from '@prisma/client'

export interface BomRequestRecord {
  id: string
  docNo: string
  customerId: string
  quotationId: string | null
  quotationItemId: string | null
  customerPoNo: string | null
  productName: string
  drawingNo: string
  drawingVersionId: string | null
  drawingVersion: string
  material: string
  surfaceTreatment: string
  inspection: string
  packing: string
  quantity: string
  targetDeliveryDate: Date | null
  productionType: BomProductionType
  fromSampleNo: string | null
  specialRequirement: string | null
  status: BomRequestStatus
  ownerUserCode: string
  submittedAt: Date | null
  claimedAt: Date | null
  claimedBy: string | null
  /** 退回累计等待毫秒数 */
  returnedMs: bigint
  returnedAt: Date | null
  returnReason: string | null
  /** ENG-05 双状态，分别落库 */
  bomReady: boolean
  programReady: boolean
  bomReadyAt: Date | null
  programReadyAt: Date | null
  productCode: string | null
  versionLock: number
}

export type BomRequestDraft = Omit<
  BomRequestRecord,
  | 'id'
  | 'docNo'
  | 'status'
  | 'submittedAt'
  | 'claimedAt'
  | 'claimedBy'
  | 'returnedMs'
  | 'returnedAt'
  | 'returnReason'
  | 'bomReady'
  | 'programReady'
  | 'bomReadyAt'
  | 'programReadyAt'
  | 'productCode'
  | 'versionLock'
>

export interface CreateBomRequestData extends BomRequestDraft {
  docNo: string
  createdBy: string
}

/** 状态迁移与工程回传时一并写入的字段。undefined 表示不动。 */
export interface BomRequestPatch {
  status?: BomRequestStatus
  submittedAt?: Date | null
  claimedAt?: Date | null
  claimedBy?: string | null
  returnedMs?: bigint
  returnedAt?: Date | null
  returnReason?: string | null
  bomReady?: boolean
  programReady?: boolean
  bomReadyAt?: Date | null
  programReadyAt?: Date | null
  productCode?: string | null
  updatedBy: string
}

export interface BomRequestQuery {
  customerId?: string
  status?: BomRequestStatus
  productionType?: BomProductionType
  ownerUserCode?: string
  /** 按报价单号过滤（业务常按报价号找申请） */
  quotationId?: string
  /** 提交日期区间，两端可单独给 */
  submittedFrom?: Date
  submittedTo?: Date
  limit: number
}

export interface BomRequestRepositoryPort {
  findById(id: string): Promise<BomRequestRecord | null>
  list(query: BomRequestQuery): Promise<BomRequestRecord[]>
  create(data: CreateBomRequestData): Promise<BomRequestRecord>
  /** 带乐观锁的内容替换；版本冲突或已离开可编辑态返回 null */
  updateDraft(
    id: string,
    versionLock: number,
    draft: BomRequestDraft,
    updatedBy: string,
  ): Promise<BomRequestRecord | null>
  /** 带乐观锁的状态与工程结果写入；版本冲突返回 null */
  patch(id: string, versionLock: number, patch: BomRequestPatch): Promise<BomRequestRecord | null>
}

export const BOM_REQUEST_REPOSITORY = Symbol('BOM_REQUEST_REPOSITORY')
