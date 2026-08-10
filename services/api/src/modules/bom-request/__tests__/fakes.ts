import type {
  BomRequestDraft,
  BomRequestPatch,
  BomRequestQuery,
  BomRequestRecord,
  BomRequestRepositoryPort,
  CreateBomRequestData,
} from '../repositories/bom-request.repository.port'

let seq = 0

/** 返回拷贝，不把内部引用交出去——否则乐观锁的测试会假绿。 */
const clone = (record: BomRequestRecord): BomRequestRecord => ({ ...record })

export class FakeBomRequestRepository implements BomRequestRepositoryPort {
  readonly rows: BomRequestRecord[] = []

  async findById(id: string): Promise<BomRequestRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    return row ? clone(row) : null
  }

  async list(query: BomRequestQuery): Promise<BomRequestRecord[]> {
    return this.rows
      .filter((row) => !query.customerId || row.customerId === query.customerId)
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => !query.productionType || row.productionType === query.productionType)
      .filter((row) => !query.ownerUserCode || row.ownerUserCode === query.ownerUserCode)
      .filter((row) => !query.quotationId || row.quotationId === query.quotationId)
      .filter((row) => !query.submittedFrom || (row.submittedAt ?? new Date(0)) >= query.submittedFrom)
      .filter((row) => !query.submittedTo || (row.submittedAt ?? new Date(0)) <= query.submittedTo)
      .slice(0, query.limit)
      .map(clone)
  }

  async create(data: CreateBomRequestData): Promise<BomRequestRecord> {
    const { docNo, createdBy: _createdBy, ...draft } = data
    const record: BomRequestRecord = {
      ...draft,
      id: `BR${(seq += 1)}`,
      docNo,
      status: 'DRAFT',
      submittedAt: null,
      claimedAt: null,
      claimedBy: null,
      returnedMs: 0n,
      returnedAt: null,
      returnReason: null,
      bomReady: false,
      programReady: false,
      bomReadyAt: null,
      programReadyAt: null,
      productCode: null,
      versionLock: 0,
    }
    this.rows.push(record)
    return clone(record)
  }

  async updateDraft(
    id: string,
    versionLock: number,
    draft: BomRequestDraft,
  ): Promise<BomRequestRecord | null> {
    const row = this.rows.find(
      (item) =>
        item.id === id &&
        item.versionLock === versionLock &&
        (item.status === 'DRAFT' || item.status === 'RETURNED'),
    )
    if (!row) return null

    Object.assign(row, draft)
    row.versionLock += 1
    return clone(row)
  }

  async patch(
    id: string,
    versionLock: number,
    patch: BomRequestPatch,
  ): Promise<BomRequestRecord | null> {
    const row = this.rows.find((item) => item.id === id && item.versionLock === versionLock)
    if (!row) return null

    const { updatedBy: _updatedBy, ...fields } = patch
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) Object.assign(row, { [key]: value })
    }
    row.versionLock += 1
    return clone(row)
  }
}
