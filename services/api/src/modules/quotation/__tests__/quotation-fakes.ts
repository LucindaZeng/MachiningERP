import type {
  CreateQuotationData,
  QuotationHeaderDraft,
  QuotationItemDraft,
  QuotationRecord,
  QuotationRepositoryPort,
  QuotationStatusPatch,
} from '../repositories/quotation.repository.port'
import type {
  CreateQuoteChangeRequestData,
  HandleQuoteChangeData,
  QuoteChangeRequestRecord,
  QuoteChangeRequestRepositoryPort,
} from '../repositories/quote-change-request.repository.port'

let seq = 0
const nextId = (prefix: string): string => `${prefix}${(seq += 1)}`

function materialize(items: QuotationItemDraft[]): QuotationRecord['items'] {
  return items.map((item) => ({
    ...item,
    id: nextId('QI'),
    tiers: item.tiers.map((tier) => ({ ...tier, id: nextId('QT') })),
  }))
}

/**
 * 返回拷贝而不是内部对象引用。真实仓储每次查询都产出新对象；
 * 若把内部对象直接交出去，后续写入会「穿透」到调用方早先拿到的快照上，
 * 版本号看起来永远是最新的——乐观锁的测试就成了假绿。
 */
function clone(record: QuotationRecord): QuotationRecord {
  return {
    ...record,
    items: record.items.map((item) => ({ ...item, tiers: item.tiers.map((tier) => ({ ...tier })) })),
  }
}

export class FakeQuotationRepository implements QuotationRepositoryPort {
  readonly rows: QuotationRecord[] = []

  async findById(id: string): Promise<QuotationRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    return row ? clone(row) : null
  }

  async listByCustomer(customerId: string, limit: number): Promise<QuotationRecord[]> {
    return this.rows
      .filter((row) => row.customerId === customerId)
      .slice(0, limit)
      .map(clone)
  }

  async create(data: CreateQuotationData): Promise<QuotationRecord> {
    const record: QuotationRecord = {
      id: nextId('Q'),
      docNo: data.docNo,
      version: data.version,
      rootId: data.rootId,
      customerId: data.customerId,
      costAnalysisId: data.costAnalysisId,
      template: data.template,
      currency: data.currency,
      fxRateMicros: data.fxRateMicros,
      fxQuotedOn: data.fxQuotedOn,
      moldFeeMinor: data.moldFeeMinor,
      terms: data.terms,
      status: 'DRAFT',
      validUntil: null,
      submittedBy: null,
      submittedAt: null,
      approvedBy: null,
      approvedAt: null,
      rejectReason: null,
      items: materialize(data.items),
      createdBy: data.createdBy,
      versionLock: 0,
    }
    this.rows.push(record)
    return clone(record)
  }

  async replaceItems(
    id: string,
    versionLock: number,
    header: QuotationHeaderDraft,
    items: QuotationItemDraft[],
  ): Promise<QuotationRecord | null> {
    const row = this.rows.find(
      (item) => item.id === id && item.versionLock === versionLock && item.status === 'DRAFT',
    )
    if (!row) return null

    Object.assign(row, header)
    row.items = materialize(items)
    row.versionLock += 1
    return clone(row)
  }

  async updateStatus(
    id: string,
    versionLock: number,
    patch: QuotationStatusPatch,
  ): Promise<QuotationRecord | null> {
    const row = this.rows.find((item) => item.id === id && item.versionLock === versionLock)
    if (!row) return null

    row.status = patch.status
    if (patch.validUntil !== undefined) row.validUntil = patch.validUntil
    if (patch.submittedBy !== undefined) row.submittedBy = patch.submittedBy
    if (patch.submittedAt !== undefined) row.submittedAt = patch.submittedAt
    if (patch.approvedBy !== undefined) row.approvedBy = patch.approvedBy
    if (patch.approvedAt !== undefined) row.approvedAt = patch.approvedAt
    if (patch.rejectReason !== undefined) row.rejectReason = patch.rejectReason
    row.versionLock += 1
    return clone(row)
  }
}

export class FakeQuoteChangeRepository implements QuoteChangeRequestRepositoryPort {
  readonly rows: QuoteChangeRequestRecord[] = []

  async findById(id: string): Promise<QuoteChangeRequestRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    return row ? { ...row } : null
  }

  async listByQuotation(quotationId: string): Promise<QuoteChangeRequestRecord[]> {
    return this.rows.filter((row) => row.quotationId === quotationId).map((row) => ({ ...row }))
  }

  async create(data: CreateQuoteChangeRequestData): Promise<QuoteChangeRequestRecord> {
    const record: QuoteChangeRequestRecord = {
      id: nextId('QCR'),
      requestNo: data.requestNo,
      quotationId: data.quotationId,
      targetPrices: data.targetPrices,
      reason: data.reason,
      status: 'SUBMITTED',
      submittedBy: data.submittedBy,
      submittedAt: new Date('2026-08-08T02:00:00Z'),
      handledBy: null,
      handledAt: null,
      rejectReason: null,
      revisedCostAnalysisId: null,
      versionLock: 0,
    }
    this.rows.push(record)
    return { ...record }
  }

  async handle(
    id: string,
    versionLock: number,
    data: HandleQuoteChangeData,
  ): Promise<QuoteChangeRequestRecord | null> {
    const row = this.rows.find(
      (item) => item.id === id && item.versionLock === versionLock && item.status === 'SUBMITTED',
    )
    if (!row) return null

    row.status = data.status
    row.handledBy = data.handledBy
    row.handledAt = data.handledAt
    row.rejectReason = data.rejectReason ?? null
    row.revisedCostAnalysisId = data.revisedCostAnalysisId ?? null
    row.versionLock += 1
    return { ...row }
  }
}
