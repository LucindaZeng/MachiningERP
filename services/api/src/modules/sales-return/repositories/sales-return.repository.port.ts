import type {
  ReturnDisposition,
  ReturnResponsibility,
  SalesReturnStatus,
} from '@prisma/client'

export interface SalesReturnLineRecord {
  id: string
  sequence: number
  shipmentLineId: string | null
  orderLineId: string | null
  productName: string
  drawingNo: string
  batchNo: string
  /** 数量一律 decimal 字符串，禁止浮点 */
  returnQty: string
  unitPriceMinor: bigint
  amountMinor: bigint
  reason: string
  responsibility: ReturnResponsibility
  disposition: ReturnDisposition
  dispositionNote: string | null
  allowanceMinor: bigint | null
  receivedAt: Date | null
  receivedQty: string | null
  settledByCreditNote: boolean
  creditNoteDocNo: string | null
}

export interface SalesReturnRecord {
  id: string
  docNo: string
  orderId: string
  shipmentId: string | null
  customerId: string
  currency: string
  reason: string
  eightDNo: string | null
  eightDRequired: boolean
  status: SalesReturnStatus
  ownerUserCode: string
  complaintAt: Date
  respondedAt: Date | null
  judgedAt: Date | null
  judgedBy: string | null
  approvedAt: Date | null
  approvedBy: string | null
  closedAt: Date | null
  needFinanceApproval: boolean
  rejectReason: string | null
  lines: SalesReturnLineRecord[]
  versionLock: number
}

export type SalesReturnLineDraft = Omit<
  SalesReturnLineRecord,
  | 'id'
  | 'responsibility'
  | 'disposition'
  | 'dispositionNote'
  | 'allowanceMinor'
  | 'receivedAt'
  | 'receivedQty'
  | 'settledByCreditNote'
  | 'creditNoteDocNo'
>

export interface CreateSalesReturnData {
  docNo: string
  orderId: string
  shipmentId: string | null
  customerId: string
  currency: string
  reason: string
  eightDNo: string | null
  eightDRequired: boolean
  ownerUserCode: string
  complaintAt: Date
  createdBy: string
  lines: SalesReturnLineDraft[]
}

/** 单头补丁；时间戳由服务层按迁移目标填，repository 不做业务判断。 */
export interface SalesReturnPatch {
  status?: SalesReturnStatus
  respondedAt?: Date | null
  judgedAt?: Date | null
  judgedBy?: string | null
  approvedAt?: Date | null
  approvedBy?: string | null
  closedAt?: Date | null
  needFinanceApproval?: boolean
  rejectReason?: string | null
  eightDNo?: string | null
  eightDRequired?: boolean
  updatedBy: string
}

/** 逐行补丁：责任归属由品质写，处置由业务写，入库由仓储写——三方各改各的字段。 */
export interface SalesReturnLinePatch {
  responsibility?: ReturnResponsibility
  disposition?: ReturnDisposition
  dispositionNote?: string | null
  allowanceMinor?: bigint | null
  receivedAt?: Date | null
  receivedQty?: string | null
  settledByCreditNote?: boolean
  creditNoteDocNo?: string | null
}

export interface SalesReturnQuery {
  customerId?: string
  orderId?: string
  shipmentId?: string
  status?: SalesReturnStatus
  ownerUserCode?: string
  /** 结案日期区间——对账取数按 closedAt 落期间，不按登记日 */
  closedFrom?: Date
  closedTo?: Date
  limit?: number
}

export interface SalesReturnRepositoryPort {
  create(data: CreateSalesReturnData): Promise<SalesReturnRecord>
  findById(id: string): Promise<SalesReturnRecord | null>
  list(query: SalesReturnQuery): Promise<SalesReturnRecord[]>
  /** 乐观锁：versionLock 不匹配返回 null，由调用方翻译成「请刷新后重试」 */
  patch(
    id: string,
    versionLock: number,
    patch: SalesReturnPatch,
  ): Promise<SalesReturnRecord | null>
  /** 逐行更新，整体一个事务；任一行不存在则返回 null */
  patchLines(
    id: string,
    versionLock: number,
    patches: ReadonlyArray<{ lineId: string; patch: SalesReturnLinePatch }>,
    updatedBy: string,
  ): Promise<SalesReturnRecord | null>
}

export const SALES_RETURN_REPOSITORY = Symbol('SALES_RETURN_REPOSITORY')
