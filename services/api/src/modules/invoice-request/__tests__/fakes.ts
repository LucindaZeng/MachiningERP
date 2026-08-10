import type {
  CreateInvoiceData,
  InvoicePatch,
  InvoiceQuery,
  InvoiceRecord,
  InvoiceRepositoryPort,
} from '../repositories/invoice-request.repository.port'

let seq = 0

/** 一律返回深拷贝：交出内部引用会让乐观锁的测试假绿（bom-request 上栽过一次）。 */
function clone(record: InvoiceRecord): InvoiceRecord {
  return { ...record, lines: record.lines.map((line) => ({ ...line })) }
}

export class FakeInvoiceRepository implements InvoiceRepositoryPort {
  readonly rows: InvoiceRecord[] = []

  async findById(id: string): Promise<InvoiceRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    return row ? clone(row) : null
  }

  async list(query: InvoiceQuery): Promise<InvoiceRecord[]> {
    return this.rows
      .filter((row) => !query.customerId || row.customerId === query.customerId)
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => !query.invoiceKind || row.invoiceKind === query.invoiceKind)
      .filter((row) => !query.kind || row.kind === query.kind)
      .filter((row) => !query.issuedFrom || (row.issuedAt ?? new Date(0)) >= query.issuedFrom)
      .filter((row) => !query.issuedTo || (row.issuedAt ?? new Date(0)) <= query.issuedTo)
      .slice(0, query.limit)
      .map(clone)
  }

  async create(data: CreateInvoiceData): Promise<InvoiceRecord> {
    const { lines, createdBy: _createdBy, ...header } = data
    const record: InvoiceRecord = {
      ...header,
      id: `INV${(seq += 1)}`,
      status: 'DRAFT',
      submittedAt: null,
      invoiceNo: null,
      issuedAt: null,
      sentAt: null,
      signedAt: null,
      versionLock: 0,
      lines: lines.map((line, index) => ({ ...line, id: `INVL${(seq += 1)}-${index}` })),
    }
    this.rows.push(record)
    return clone(record)
  }

  async patch(id: string, versionLock: number, patch: InvoicePatch): Promise<InvoiceRecord | null> {
    const row = this.rows.find((item) => item.id === id && item.versionLock === versionLock)
    if (!row) return null

    const { updatedBy: _updatedBy, ...fields } = patch
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) Object.assign(row, { [key]: value })
    }
    row.versionLock += 1
    return clone(row)
  }

  async creditedAmountOf(originalId: string): Promise<bigint> {
    return this.rows
      .filter((row) => row.originalId === originalId && row.kind === 'CREDIT_NOTE')
      .filter((row) => row.status === 'COMPLETED')
      .reduce((sum, row) => sum + (row.amountIncTaxMinor < 0n ? -row.amountIncTaxMinor : row.amountIncTaxMinor), 0n)
  }
}
