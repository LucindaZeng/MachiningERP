import { addQuantity, quantityOf } from '@machining-erp/shared'

import type { QcReleasePort, QcReleaseQuery, QcReleaseVerdict } from '../repositories/qc-release.port'
import type { ReceiptEntry, ReceiptPort, ReceiptSummary } from '../repositories/receipt.port'
import type {
  CreateShipmentData,
  ShipmentPatch,
  ShipmentQuery,
  ShipmentRecord,
  ShipmentRepositoryPort,
  TailResolution,
} from '../repositories/shipment.repository.port'
import type {
  SourceDocumentEntry,
  StatementSourcePort,
} from '../repositories/statement-source.port'
import type {
  CreateStatementData,
  StatementPatch,
  StatementQuery,
  StatementRecord,
  StatementRepositoryPort,
} from '../repositories/statement.repository.port'

let seq = 0

/**
 * 一律返回深拷贝。上一轮 bom-request 的教训：假仓储把内部引用交出去，
 * 乐观锁的测试会「通过」得毫无意义——服务改的其实就是仓储里那一份。
 */
function cloneShipment(record: ShipmentRecord): ShipmentRecord {
  return { ...record, lines: record.lines.map((line) => ({ ...line })) }
}

function cloneStatement(record: StatementRecord): StatementRecord {
  return { ...record, lines: record.lines.map((line) => ({ ...line })) }
}

const SHIPPED_STATUSES = new Set(['SHIPPED', 'SIGNED', 'INVOICED', 'CLOSED'])

export class FakeShipmentRepository implements ShipmentRepositoryPort {
  readonly rows: ShipmentRecord[] = []

  async findById(id: string): Promise<ShipmentRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    return row ? cloneShipment(row) : null
  }

  async findByDocNo(docNo: string): Promise<ShipmentRecord | null> {
    const row = this.rows.find((item) => item.docNo === docNo)
    return row ? cloneShipment(row) : null
  }

  async list(query: ShipmentQuery): Promise<ShipmentRecord[]> {
    return this.rows
      .filter((row) => !query.customerId || row.customerId === query.customerId)
      .filter((row) => !query.orderId || row.orderId === query.orderId)
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => !query.ownerUserCode || row.ownerUserCode === query.ownerUserCode)
      .filter((row) => !query.shippedFrom || (row.shippedAt ?? new Date(0)) >= query.shippedFrom)
      .filter((row) => !query.shippedTo || (row.shippedAt ?? new Date(0)) <= query.shippedTo)
      .slice(0, query.limit)
      .map(cloneShipment)
  }

  async create(data: CreateShipmentData): Promise<ShipmentRecord> {
    const { docNo, createdBy: _createdBy, lines, ...header } = data
    const record: ShipmentRecord = {
      ...header,
      id: `SHP${(seq += 1)}`,
      docNo,
      invoiceNo: null,
      replacesReturnId: header.replacesReturnId ?? null,
      status: 'PLANNED',
      packedAt: null,
      shippedAt: null,
      signedAt: null,
      invoicedAt: null,
      closedAt: null,
      versionLock: 0,
      lines: lines.map((line, index) => ({
        ...line,
        id: `SHPL${(seq += 1)}-${index}`,
        tailPlan: null,
        tailResolvedQty: quantityOf('0'),
        tailApprovedBy: null,
        tailApprovedAt: null,
        tailRemark: null,
      })),
    }
    this.rows.push(record)
    return cloneShipment(record)
  }

  async patch(
    id: string,
    versionLock: number,
    patch: ShipmentPatch,
  ): Promise<ShipmentRecord | null> {
    const row = this.rows.find((item) => item.id === id && item.versionLock === versionLock)
    if (!row) return null

    const { updatedBy: _updatedBy, ...fields } = patch
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) Object.assign(row, { [key]: value })
    }
    row.versionLock += 1
    return cloneShipment(row)
  }

  async applyTailResolutions(
    id: string,
    versionLock: number,
    resolutions: readonly TailResolution[],
  ): Promise<ShipmentRecord | null> {
    const row = this.rows.find((item) => item.id === id && item.versionLock === versionLock)
    if (!row) return null

    for (const resolution of resolutions) {
      const line = row.lines.find((candidate) => candidate.id === resolution.lineId)
      if (!line) continue
      line.tailPlan = resolution.tailPlan
      line.tailResolvedQty = resolution.tailResolvedQty
      line.tailApprovedBy = resolution.tailApprovedBy
      line.tailApprovedAt = resolution.tailApprovedAt
      line.tailRemark = resolution.tailRemark
    }
    row.versionLock += 1
    return cloneShipment(row)
  }

  async sumShippedByOrderLine(orderLineIds: readonly string[]): Promise<Record<string, string>> {
    const totals: Record<string, string> = {}
    for (const row of this.rows) {
      if (!SHIPPED_STATUSES.has(row.status)) continue
      for (const line of row.lines) {
        if (!orderLineIds.includes(line.orderLineId)) continue
        totals[line.orderLineId] = addQuantity(
          totals[line.orderLineId] ?? quantityOf('0'),
          line.shippedQty,
        )
      }
    }
    return totals
  }
}

export class FakeStatementRepository implements StatementRepositoryPort {
  readonly rows: StatementRecord[] = []

  async findById(id: string): Promise<StatementRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    return row ? cloneStatement(row) : null
  }

  async list(query: StatementQuery): Promise<StatementRecord[]> {
    const matched = this.rows
      .filter((row) => !query.customerId || row.customerId === query.customerId)
      .filter((row) => !query.status || row.status === query.status)
      .sort((left, right) => right.version - left.version)

    const filtered = query.latestOnly
      ? matched.filter(
          (row, index) =>
            matched.findIndex(
              (other) =>
                other.customerId === row.customerId &&
                other.periodFrom.getTime() === row.periodFrom.getTime() &&
                other.periodTo.getTime() === row.periodTo.getTime(),
            ) === index,
        )
      : matched

    return filtered.slice(0, query.limit).map(cloneStatement)
  }

  async create(data: CreateStatementData): Promise<StatementRecord> {
    const { lines, createdBy: _createdBy, ...header } = data
    const record: StatementRecord = {
      ...header,
      id: `STM${(seq += 1)}`,
      status: 'DRAFT',
      sentAt: null,
      confirmedAt: null,
      versionLock: 0,
      lines: lines.map((line, index) => ({ ...line, id: `STML${(seq += 1)}-${index}` })),
    }
    this.rows.push(record)
    return cloneStatement(record)
  }

  async patch(
    id: string,
    versionLock: number,
    patch: StatementPatch,
  ): Promise<StatementRecord | null> {
    const row = this.rows.find((item) => item.id === id && item.versionLock === versionLock)
    if (!row) return null

    const { updatedBy: _updatedBy, ...fields } = patch
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) Object.assign(row, { [key]: value })
    }
    row.versionLock += 1
    return cloneStatement(row)
  }

  async setLineMatched(statementId: string, lineId: string, matched: boolean): Promise<boolean> {
    const row = this.rows.find((item) => item.id === statementId)
    const line = row?.lines.find((candidate) => candidate.id === lineId)
    if (!line) return false

    line.matched = matched
    return true
  }

  async latestVersion(customerId: string, periodFrom: Date, periodTo: Date): Promise<number> {
    return this.rows
      .filter(
        (row) =>
          row.customerId === customerId &&
          row.periodFrom.getTime() === periodFrom.getTime() &&
          row.periodTo.getTime() === periodTo.getTime(),
      )
      .reduce((max, row) => Math.max(max, row.version), 0)
  }
}

/** 可编程的品质放行假端口：默认全放行，可按「图号|批次」指定不放行。 */
export class FakeQcReleasePort implements QcReleasePort {
  readonly blocked = new Map<string, string>()

  async verdictFor(query: QcReleaseQuery): Promise<QcReleaseVerdict> {
    const reason = this.blocked.get(`${query.drawingNo}|${query.batchNo}`)
    return reason
      ? { released: false, reason, inspectionNo: null }
      : { released: true, reason: null, inspectionNo: 'IQC-001' }
  }

  block(drawingNo: string, batchNo: string, reason: string): void {
    this.blocked.set(`${drawingNo}|${batchNo}`, reason)
  }
}

export class FakeReceiptPort implements ReceiptPort {
  receivedMinor = 0n
  entries: ReceiptEntry[] = []
  overdueMinor = 0n

  async receivedForOrder(): Promise<ReceiptSummary> {
    return { receivedMinor: this.receivedMinor, currency: 'CNY' }
  }

  async receiptsInPeriod(): Promise<ReceiptEntry[]> {
    return this.entries.map((entry) => ({ ...entry }))
  }

  async overdueForCustomer(): Promise<bigint> {
    return this.overdueMinor
  }
}

export class FakeStatementSourcePort implements StatementSourcePort {
  invoices: SourceDocumentEntry[] = []
  returns: SourceDocumentEntry[] = []
  opening = 0n

  async invoicesInPeriod(): Promise<SourceDocumentEntry[]> {
    return this.invoices.map((entry) => ({ ...entry }))
  }

  async returnsInPeriod(): Promise<SourceDocumentEntry[]> {
    return this.returns.map((entry) => ({ ...entry }))
  }

  async openingBalance(): Promise<bigint> {
    return this.opening
  }
}
