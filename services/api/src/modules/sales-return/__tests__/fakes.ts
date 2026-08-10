import { quantityOf } from '@machining-erp/shared'

import type {
  ReturnSettlementPort,
  ReturnSettlementRequest,
  ReturnSettlementResult,
} from '../repositories/return-settlement.port'
import type {
  CreateSalesReturnData,
  SalesReturnLinePatch,
  SalesReturnLineRecord,
  SalesReturnPatch,
  SalesReturnQuery,
  SalesReturnRecord,
  SalesReturnRepositoryPort,
} from '../repositories/sales-return.repository.port'

let seq = 0

/**
 * 一律返回深拷贝。这条是 bom-request 那一轮买来的教训：
 * 假仓储把内部引用交出去，乐观锁的测试会「通过」得毫无意义——
 * 服务改的其实就是仓储里那一份。
 */
function clone(record: SalesReturnRecord): SalesReturnRecord {
  return { ...record, lines: record.lines.map((line) => ({ ...line })) }
}

export class FakeSalesReturnRepository implements SalesReturnRepositoryPort {
  readonly rows: SalesReturnRecord[] = []

  async findById(id: string): Promise<SalesReturnRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    return row ? clone(row) : null
  }

  async list(query: SalesReturnQuery): Promise<SalesReturnRecord[]> {
    return this.rows
      .filter((row) => !query.customerId || row.customerId === query.customerId)
      .filter((row) => !query.orderId || row.orderId === query.orderId)
      .filter((row) => !query.shipmentId || row.shipmentId === query.shipmentId)
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => !query.ownerUserCode || row.ownerUserCode === query.ownerUserCode)
      .filter((row) => !query.closedFrom || (row.closedAt ?? new Date(0)) >= query.closedFrom)
      .filter((row) => !query.closedTo || (row.closedAt ?? new Date(0)) <= query.closedTo)
      .slice(0, query.limit ?? undefined)
      .map(clone)
  }

  async create(data: CreateSalesReturnData): Promise<SalesReturnRecord> {
    const { docNo, createdBy: _createdBy, lines, ...header } = data
    const record: SalesReturnRecord = {
      ...header,
      id: `RMA${(seq += 1)}`,
      docNo,
      status: 'REGISTERED',
      respondedAt: null,
      judgedAt: null,
      judgedBy: null,
      approvedAt: null,
      approvedBy: null,
      closedAt: null,
      needFinanceApproval: false,
      rejectReason: null,
      versionLock: 0,
      lines: lines.map((line, index) => ({
        ...line,
        id: `${docNo}-L${index + 1}`,
        returnQty: quantityOf(line.returnQty),
        responsibility: 'UNDECIDED' as const,
        disposition: 'UNDECIDED' as const,
        dispositionNote: null,
        allowanceMinor: null,
        receivedAt: null,
        receivedQty: null,
        settledByCreditNote: false,
        creditNoteDocNo: null,
      })),
    }
    this.rows.push(record)
    return clone(record)
  }

  async patch(
    id: string,
    versionLock: number,
    patch: SalesReturnPatch,
  ): Promise<SalesReturnRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    if (!row || row.versionLock !== versionLock) return null

    const { updatedBy: _updatedBy, ...rest } = patch
    Object.assign(row, rest)
    row.versionLock += 1
    return clone(row)
  }

  async patchLines(
    id: string,
    versionLock: number,
    patches: ReadonlyArray<{ lineId: string; patch: SalesReturnLinePatch }>,
    _updatedBy: string,
  ): Promise<SalesReturnRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    if (!row || row.versionLock !== versionLock) return null

    for (const entry of patches) {
      const line = row.lines.find((item) => item.id === entry.lineId)
      if (!line) return null
      applyLinePatch(line, entry.patch)
    }
    row.versionLock += 1
    return clone(row)
  }
}

function applyLinePatch(line: SalesReturnLineRecord, patch: SalesReturnLinePatch): void {
  if (patch.responsibility !== undefined) line.responsibility = patch.responsibility
  if (patch.disposition !== undefined) line.disposition = patch.disposition
  if (patch.dispositionNote !== undefined) line.dispositionNote = patch.dispositionNote
  if (patch.allowanceMinor !== undefined) line.allowanceMinor = patch.allowanceMinor
  if (patch.receivedAt !== undefined) line.receivedAt = patch.receivedAt
  if (patch.receivedQty !== undefined) {
    line.receivedQty = patch.receivedQty === null ? null : quantityOf(patch.receivedQty)
  }
  if (patch.settledByCreditNote !== undefined) line.settledByCreditNote = patch.settledByCreditNote
  if (patch.creditNoteDocNo !== undefined) line.creditNoteDocNo = patch.creditNoteDocNo
}

export class FakeReturnSettlementPort implements ReturnSettlementPort {
  readonly requests: ReturnSettlementRequest[] = []

  async submitSettlement(request: ReturnSettlementRequest): Promise<ReturnSettlementResult> {
    this.requests.push(request)
    return { settlementNo: null, acceptedAt: new Date('2026-08-01T00:00:00Z') }
  }
}
