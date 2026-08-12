import type {
  AppendCorrectionData,
  AppendDeclarationData,
  AppendDocumentData,
  CreateCustomsDossierData,
  CustomsDossierPatch,
  CustomsDossierRecord,
  CustomsQuery,
  CustomsRepositoryPort,
} from '../repositories/customs.repository.port'
import type {
  DocumentRenderPort,
  DocumentRenderRequest,
  DocumentRenderResult,
} from '../repositories/document-render.port'

let seq = 0

/**
 * 一律返回深拷贝。这条是 bom-request 那一轮买来的教训：
 * 假仓储把内部引用交出去，乐观锁的测试会「通过」得毫无意义。
 */
function clone(record: CustomsDossierRecord): CustomsDossierRecord {
  return {
    ...record,
    documents: record.documents.map((doc) => ({ ...doc })),
    declarations: record.declarations.map((item) => ({
      ...item,
      lines: item.lines.map((line) => ({ ...line })),
    })),
    corrections: record.corrections.map((item) => ({
      ...item,
      lines: item.lines.map((line) => ({ ...line })),
    })),
  }
}

export class FakeCustomsRepository implements CustomsRepositoryPort {
  readonly rows: CustomsDossierRecord[] = []

  async findById(id: string): Promise<CustomsDossierRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    return row ? clone(row) : null
  }

  async list(query: CustomsQuery): Promise<CustomsDossierRecord[]> {
    return this.rows
      .filter((row) => !query.customerId || row.customerId === query.customerId)
      .filter((row) => !query.shipmentId || row.shipmentId === query.shipmentId)
      .filter((row) => !query.orderId || row.orderId === query.orderId)
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => !query.ownerUserCode || row.ownerUserCode === query.ownerUserCode)
      .slice(0, query.limit ?? undefined)
      .map(clone)
  }

  async create(data: CreateCustomsDossierData): Promise<CustomsDossierRecord> {
    const { createdBy: _createdBy, ...rest } = data
    const record: CustomsDossierRecord = {
      ...rest,
      id: `CD${(seq += 1)}`,
      status: 'DRAFT',
      checkedBy: null,
      checkedAt: null,
      declarationVersion: 0,
      declaredAt: null,
      releasedAt: null,
      documents: [],
      declarations: [],
      corrections: [],
      versionLock: 0,
    }
    this.rows.push(record)
    return clone(record)
  }

  async patch(
    id: string,
    versionLock: number,
    patch: CustomsDossierPatch,
  ): Promise<CustomsDossierRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    if (!row || row.versionLock !== versionLock) return null

    const { updatedBy: _updatedBy, ...rest } = patch
    Object.assign(row, rest)
    row.versionLock += 1
    return clone(row)
  }

  async appendDocument(
    id: string,
    versionLock: number,
    data: AppendDocumentData,
    _updatedBy: string,
  ): Promise<CustomsDossierRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    if (!row || row.versionLock !== versionLock) return null

    row.documents.push({
      id: `${id}-${data.kind}-V${data.version}`,
      kind: data.kind,
      version: data.version,
      objectKey: data.objectKey,
      fileName: data.fileName,
      exchangeRate: data.exchangeRate,
      currency: data.currency,
      generatedAt: new Date('2026-07-27T10:00:00Z'),
      generatedBy: data.generatedBy,
    })
    row.versionLock += 1
    return clone(row)
  }

  async appendDeclaration(
    id: string,
    versionLock: number,
    data: AppendDeclarationData,
    patch: CustomsDossierPatch,
  ): Promise<CustomsDossierRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    if (!row || row.versionLock !== versionLock) return null

    row.declarations.push({
      id: `${id}-DECL-${data.version}`,
      version: data.version,
      declaredAt: data.declaredAt,
      declaredBy: data.declaredBy,
      receiptNo: null,
      receiptAt: null,
      lines: data.lines.map((line) => ({ ...line })),
    })

    const { updatedBy: _updatedBy, ...rest } = patch
    Object.assign(row, rest)
    row.versionLock += 1
    return clone(row)
  }

  async appendCorrection(
    id: string,
    versionLock: number,
    data: AppendCorrectionData,
    _updatedBy: string,
  ): Promise<CustomsDossierRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    if (!row || row.versionLock !== versionLock) return null

    row.corrections.push({
      id: `${id}-COR-${data.sequence}`,
      sequence: data.sequence,
      reason: data.reason,
      resultingDeclarationVersion: data.resultingDeclarationVersion,
      createdBy: data.createdBy,
      createdAt: new Date('2026-07-28T10:00:00Z'),
      lines: data.lines.map((line) => ({ ...line })),
    })
    row.versionLock += 1
    return clone(row)
  }

  async archiveReceipt(
    id: string,
    versionLock: number,
    declarationVersion: number,
    receiptNo: string,
    receiptAt: Date,
    _updatedBy: string,
  ): Promise<CustomsDossierRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    if (!row || row.versionLock !== versionLock) return null

    const target = row.declarations.find((item) => item.version === declarationVersion)
    if (target) {
      target.receiptNo = receiptNo
      target.receiptAt = receiptAt
    }
    row.versionLock += 1
    return clone(row)
  }
}

/** 假渲染器：可切换成「出得了文件」以覆盖 objectKey 非空的分支。 */
export class FakeDocumentRenderPort implements DocumentRenderPort {
  readonly requests: DocumentRenderRequest[] = []
  produceFiles = false

  async render(request: DocumentRenderRequest): Promise<DocumentRenderResult> {
    this.requests.push(request)
    if (!this.produceFiles) {
      return { objectKey: null, fileName: null, renderedAt: new Date() }
    }
    return {
      objectKey: `customs/${request.docNo}/${request.templateCode}-V${request.version}.pdf`,
      fileName: `${request.templateCode}-V${request.version}.pdf`,
      renderedAt: new Date(),
    }
  }
}
