import type {
  EcnChangeType,
  EcnImpactScope,
  EcnOrigin,
  EcnStatus,
} from '@prisma/client'

export interface EcnImpactRecord {
  id: string
  scope: EcnImpactScope
  /** 描述性文字（「1200 件」「304 棒料 620kg」），不是数字——理由见 schema 注释 */
  quantity: string
  /** 评不出金额时为 null，与「评估过且为零」区分 */
  amountMinor: bigint | null
  note: string
}

export interface EcnSignoffRecord {
  id: string
  department: string
  signedBy: string | null
  signedAt: Date | null
  opinion: string | null
  /** 各部门模块未上线期间由工程代签 */
  proxied: boolean
}

export interface EcnRequestRecord {
  id: string
  docNo: string
  customerId: string
  orderId: string | null
  productName: string
  drawingNo: string
  /** 变更链路：图纸版本 ↔ BOM ↔ 报价版本 */
  drawingVersionId: string | null
  newDrawingVersionId: string | null
  bomRequestId: string | null
  quotationId: string | null
  changeType: EcnChangeType
  origin: EcnOrigin
  urgent: boolean
  beforeValue: string
  afterValue: string
  reason: string
  routingUpdated: boolean
  effectiveBatch: string | null
  needRequote: boolean
  needOrderReapproval: boolean
  status: EcnStatus
  ownerUserCode: string
  submittedAt: Date | null
  assessedBy: string | null
  assessedAt: Date | null
  approvedBy: string | null
  approvedAt: Date | null
  closedAt: Date | null
  rejectReason: string | null
  impacts: EcnImpactRecord[]
  signoffs: EcnSignoffRecord[]
  versionLock: number
}

export type EcnImpactDraft = Omit<EcnImpactRecord, 'id'>

export interface CreateEcnRequestData {
  docNo: string
  customerId: string
  orderId: string | null
  productName: string
  drawingNo: string
  drawingVersionId: string | null
  newDrawingVersionId: string | null
  bomRequestId: string | null
  quotationId: string | null
  changeType: EcnChangeType
  origin: EcnOrigin
  urgent: boolean
  beforeValue: string
  afterValue: string
  reason: string
  ownerUserCode: string
  createdBy: string
}

/** 单头补丁。时间戳由服务层按迁移目标填，repository 不做业务判断。 */
export interface EcnRequestPatch {
  status?: EcnStatus
  routingUpdated?: boolean
  effectiveBatch?: string | null
  needRequote?: boolean
  needOrderReapproval?: boolean
  newDrawingVersionId?: string | null
  bomRequestId?: string | null
  quotationId?: string | null
  submittedAt?: Date | null
  assessedBy?: string | null
  assessedAt?: Date | null
  approvedBy?: string | null
  approvedAt?: Date | null
  closedAt?: Date | null
  rejectReason?: string | null
  updatedBy: string
}

export interface EcnQuery {
  customerId?: string
  orderId?: string
  status?: EcnStatus
  changeType?: EcnChangeType
  ownerUserCode?: string
  limit?: number
}

export interface EcnRepositoryPort {
  create(data: CreateEcnRequestData): Promise<EcnRequestRecord>
  findById(id: string): Promise<EcnRequestRecord | null>
  list(query: EcnQuery): Promise<EcnRequestRecord[]>
  /** 乐观锁：versionLock 不匹配返回 null，由调用方翻译成「请刷新后重试」 */
  patch(id: string, versionLock: number, patch: EcnRequestPatch): Promise<EcnRequestRecord | null>
  /** 整表替换影响评估（四项一起提交），同一事务 */
  replaceImpacts(
    id: string,
    versionLock: number,
    impacts: readonly EcnImpactDraft[],
    updatedBy: string,
  ): Promise<EcnRequestRecord | null>
  /** 逐条写会签结果；部门不存在则新增（upsert 语义） */
  recordSignoffs(
    id: string,
    versionLock: number,
    signoffs: ReadonlyArray<Omit<EcnSignoffRecord, 'id'>>,
    updatedBy: string,
  ): Promise<EcnRequestRecord | null>
}

export const ECN_REPOSITORY = Symbol('ECN_REPOSITORY')
