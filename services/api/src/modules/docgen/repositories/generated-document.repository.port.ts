/**
 * 生成物登记的仓储端口。
 *
 * 只有 create 与两个读方法：**生成记录一旦写下就不再变**——
 * 要新的就再出一份，旧的原样留着（与报关版本链、发票红冲同一条规矩）。
 * 没有 update，也没有 delete，端口上就看得出来。
 */
export interface GeneratedDocumentRecord {
  id: string
  sourceType: string
  sourceId: string
  sourceDocNo: string
  templateId: string
  templateVersion: number
  objectKey: string
  fileName: string
  sizeBytes: number
  documentCount: number
  generatedAt: Date
  generatedBy: string
}

export type CreateGeneratedDocumentData = Omit<GeneratedDocumentRecord, 'id' | 'generatedAt'>

export interface GeneratedDocumentQuery {
  sourceType?: string
  sourceId?: string
  generatedBy?: string
  limit?: number
}

export interface GeneratedDocumentRepositoryPort {
  create(data: CreateGeneratedDocumentData): Promise<GeneratedDocumentRecord>
  findById(id: string): Promise<GeneratedDocumentRecord | null>
  list(query: GeneratedDocumentQuery): Promise<GeneratedDocumentRecord[]>
}

export const GENERATED_DOCUMENT_REPOSITORY = Symbol('GENERATED_DOCUMENT_REPOSITORY')

/** 来源单据类型。字符串而不是外键，理由见 schema 里 `GeneratedDocument` 的注释。 */
export const DOCGEN_SOURCE_TYPES = {
  QUOTATION: 'Quotation',
  COST_ANALYSIS: 'CostAnalysis',
  STATEMENT: 'Statement',
  /** 合并导出没有单一来源单据，用导出人自己的工号占位 */
  MERGE_EXPORT: 'MergeExport',
} as const

export type DocgenSourceType = (typeof DOCGEN_SOURCE_TYPES)[keyof typeof DOCGEN_SOURCE_TYPES]
