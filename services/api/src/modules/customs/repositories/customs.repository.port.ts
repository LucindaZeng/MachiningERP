import type { CustomsDocKind, CustomsStatus } from '@prisma/client'

export interface CustomsDocumentRecord {
  id: string
  kind: CustomsDocKind
  version: number
  objectKey: string | null
  fileName: string | null
  /** 本份文件出具那一刻的汇率快照 */
  exchangeRate: string
  currency: string
  generatedAt: Date
  generatedBy: string
}

export interface CustomsDeclarationRecord {
  id: string
  version: number
  declaredAt: Date
  declaredBy: string
  receiptNo: string | null
  receiptAt: Date | null
  lines: Array<{ kind: CustomsDocKind; version: number }>
}

export interface CustomsCorrectionRecord {
  id: string
  sequence: number
  reason: string
  resultingDeclarationVersion: number
  createdBy: string
  createdAt: Date
  lines: Array<{ kind: CustomsDocKind; fromVersion: number; toVersion: number }>
}

export interface CustomsDossierRecord {
  id: string
  docNo: string
  shipmentId: string
  orderId: string
  customerId: string
  tradeMode: string
  incoterm: string
  portOfLoading: string
  destination: string
  destinationPortCode: string | null
  shippingMarks: string | null
  hsCode: string
  goodsNameCn: string
  goodsNameEn: string | null
  /** 数量一律 decimal 字符串，禁止浮点 */
  quantity: string
  unit: string
  netWeight: string
  grossWeight: string
  packages: number
  currency: string
  unitPriceMinor: bigint
  totalAmountMinor: bigint
  exchangeRate: string
  status: CustomsStatus
  ownerUserCode: string
  checkedBy: string | null
  checkedAt: Date | null
  declarationVersion: number
  declaredAt: Date | null
  releasedAt: Date | null
  documents: CustomsDocumentRecord[]
  declarations: CustomsDeclarationRecord[]
  corrections: CustomsCorrectionRecord[]
  versionLock: number
}

export type CreateCustomsDossierData = Omit<
  CustomsDossierRecord,
  | 'id'
  | 'status'
  | 'checkedBy'
  | 'checkedAt'
  | 'declarationVersion'
  | 'declaredAt'
  | 'releasedAt'
  | 'documents'
  | 'declarations'
  | 'corrections'
  | 'versionLock'
> & { createdBy: string }

/** 单头补丁；时间戳由服务层按迁移目标填，repository 不做业务判断。 */
export interface CustomsDossierPatch {
  status?: CustomsStatus
  checkedBy?: string | null
  checkedAt?: Date | null
  declarationVersion?: number
  declaredAt?: Date | null
  releasedAt?: Date | null
  destinationPortCode?: string | null
  shippingMarks?: string | null
  goodsNameEn?: string | null
  updatedBy: string
}

export interface AppendDocumentData {
  kind: CustomsDocKind
  version: number
  objectKey: string | null
  fileName: string | null
  exchangeRate: string
  currency: string
  generatedBy: string
}

export interface AppendDeclarationData {
  version: number
  declaredBy: string
  declaredAt: Date
  lines: Array<{ kind: CustomsDocKind; version: number }>
}

export interface AppendCorrectionData {
  sequence: number
  reason: string
  resultingDeclarationVersion: number
  createdBy: string
  lines: Array<{ kind: CustomsDocKind; fromVersion: number; toVersion: number }>
}

export interface CustomsQuery {
  customerId?: string
  shipmentId?: string
  orderId?: string
  status?: CustomsStatus
  ownerUserCode?: string
  limit?: number
}

export interface CustomsRepositoryPort {
  create(data: CreateCustomsDossierData): Promise<CustomsDossierRecord>
  findById(id: string): Promise<CustomsDossierRecord | null>
  list(query: CustomsQuery): Promise<CustomsDossierRecord[]>
  /** 乐观锁：versionLock 不匹配返回 null，由调用方翻译成「请刷新后重试」 */
  patch(
    id: string,
    versionLock: number,
    patch: CustomsDossierPatch,
  ): Promise<CustomsDossierRecord | null>
  /** 追加一个文件版本。**只追加不覆盖**——旧版本原样留着是本模块的核心规则。 */
  appendDocument(
    id: string,
    versionLock: number,
    data: AppendDocumentData,
    updatedBy: string,
  ): Promise<CustomsDossierRecord | null>
  /** 申报：写清单快照并推进单头，两件事必须同一个事务 */
  appendDeclaration(
    id: string,
    versionLock: number,
    data: AppendDeclarationData,
    patch: CustomsDossierPatch,
  ): Promise<CustomsDossierRecord | null>
  appendCorrection(
    id: string,
    versionLock: number,
    data: AppendCorrectionData,
    updatedBy: string,
  ): Promise<CustomsDossierRecord | null>
  /** 回执归档：挂在指定的申报版本上 */
  archiveReceipt(
    id: string,
    versionLock: number,
    declarationVersion: number,
    receiptNo: string,
    receiptAt: Date,
    updatedBy: string,
  ): Promise<CustomsDossierRecord | null>
}

export const CUSTOMS_REPOSITORY = Symbol('CUSTOMS_REPOSITORY')
