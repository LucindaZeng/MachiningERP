import { DocgenContextService } from '../services/docgen-context.service'
import { DocgenService } from '../services/docgen.service'
import { DocumentIssueService } from '../services/document-issue.service'
import { MergeExportService } from '../services/merge-export.service'
import { TemplateRendererService } from '../services/template-renderer.service'

import type { CostAnalysisRecord, QuotationRecord } from '../../quotation'
import type { StatementRecord } from '../../shipment'
import type {
  CreateGeneratedDocumentData,
  GeneratedDocumentQuery,
  GeneratedDocumentRecord,
  GeneratedDocumentRepositoryPort,
} from '../repositories/generated-document.repository.port'

/**
 * docgen 的测试台。
 *
 * 渲染那一层用**真的** `TemplateRendererService`（真模板、真 ExcelJS），
 * 只有存储与仓储换成内存假实现。理由：这个模块的价值全在「出来的文件对不对」，
 * 把渲染 mock 掉之后剩下的测试只是在验证几个字段有没有被搬运过去。
 */

/** 内存对象存储。记下每次写入，供断言键名与不可覆盖语义。 */
export class FakeStorage {
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: string }>()

  async putImmutable(objectKey: string, body: Uint8Array, contentType: string): Promise<void> {
    if (this.objects.has(objectKey)) {
      throw new Error(`对象已存在，不可覆盖：${objectKey}`)
    }
    this.objects.set(objectKey, { bytes: body, contentType })
  }
}

export class FakeGeneratedRepository implements GeneratedDocumentRepositoryPort {
  readonly rows: GeneratedDocumentRecord[] = []
  private sequence = 0

  async create(data: CreateGeneratedDocumentData): Promise<GeneratedDocumentRecord> {
    this.sequence += 1
    const record: GeneratedDocumentRecord = {
      ...data,
      id: `GEN-${this.sequence}`,
      generatedAt: new Date(2026, 7, 11),
    }
    this.rows.push(record)
    return clone(record)
  }

  async findById(id: string): Promise<GeneratedDocumentRecord | null> {
    const found = this.rows.find((row) => row.id === id)
    return found ? clone(found) : null
  }

  async list(query: GeneratedDocumentQuery): Promise<GeneratedDocumentRecord[]> {
    return this.rows
      .filter((row) => !query.sourceType || row.sourceType === query.sourceType)
      .filter((row) => !query.sourceId || row.sourceId === query.sourceId)
      .map(clone)
  }
}

/** 每次读写都克隆——共享引用的假仓储会掩盖真实实现里必然存在的序列化边界。 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (_key, raw) =>
    typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(raw) ? new Date(raw) : raw,
  ) as T
}

export const AUDIT_LOG: Array<Record<string, unknown>> = []

export interface HarnessInput {
  quotations?: QuotationRecord[]
  costAnalyses?: CostAnalysisRecord[]
  statements?: StatementRecord[]
  totalsOf?: (record: CostAnalysisRecord) => unknown
}

export interface Harness {
  docgen: DocgenService
  merge: MergeExportService
  storage: FakeStorage
  repository: FakeGeneratedRepository
  audits: Array<Record<string, unknown>>
}

export function buildHarness(input: HarnessInput = {}): Harness {
  const storage = new FakeStorage()
  const repository = new FakeGeneratedRepository()
  const audits: Array<Record<string, unknown>> = []

  const renderer = new TemplateRendererService()
  const issuer = new DocumentIssueService(renderer, storage as never)

  const context = new DocgenContextService(
    { profileFor: async (id: string) => ({ name: `客户-${id}` }), invoiceProfileFor: async (id: string) => ({ name: `客户-${id}`, invoiceAddress: '东莞市清溪镇', ownerEmail: 'a@b.c', paymentTerm: '月结30天' }) } as never,
    { findByUserCode: async (code: string) => ({ displayName: `姓名-${code}` }) } as never,
    { load: async (id: string) => ({ docNo: `SHP-${id}` }) } as never,
    { load: async (id: string) => ({ docNo: `SO-${id}` }) } as never,
  )

  const quotations = {
    load: async (id: string) => findOr(input.quotations, id, '报价单'),
  }
  const costing = {
    load: async (id: string) => findOr(input.costAnalyses, id, '成本分析'),
    totalsOf: input.totalsOf ?? defaultTotals,
  }
  const statements = {
    load: async (id: string) => findOr(input.statements, id, '对账单'),
  }

  const docgen = new DocgenService(
    quotations as never,
    costing as never,
    statements as never,
    context,
    issuer,
    { record: async (entry: Record<string, unknown>) => void audits.push(entry) } as never,
    repository,
  )

  const merge = new MergeExportService(
    quotations as never,
    costing as never,
    context,
    docgen,
  )

  return { docgen, merge, storage, repository, audits }
}

function findOr<T extends { id: string }>(rows: T[] | undefined, id: string, label: string): T {
  const found = (rows ?? []).find((row) => row.id === id)
  if (!found) throw new Error(`测试台里没有 id=${id} 的${label}`)
  return found
}

/** 成本合计的默认假算法：够用来验证「金额被搬到了正确的格子」。 */
function defaultTotals(record: CostAnalysisRecord): unknown {
  const lines = record.lines.map((line, index) => ({
    materialAmount: { minor: BigInt((index + 1) * 1000), currency: record.currency },
    processTotal: { minor: 0n, currency: record.currency },
    subtotal: { minor: BigInt((index + 1) * 2000), currency: record.currency },
    loss: { minor: 100n, currency: record.currency },
    overhead: { minor: 200n, currency: record.currency },
    total: { minor: BigInt((index + 1) * 2300), currency: record.currency },
    totalWithVat: { minor: BigInt((index + 1) * 2599), currency: record.currency },
    exact: { total: '0', totalWithVat: '0' },
  }))

  return {
    lines,
    total: { minor: 2300n, currency: record.currency },
    totalWithVat: { minor: 2599n, currency: record.currency },
    exact: { total: '0', totalWithVat: '0' },
  }
}
