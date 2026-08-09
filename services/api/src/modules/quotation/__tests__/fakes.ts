import type {
  CostAnalysisLineDraft,
  CostAnalysisRecord,
  CostAnalysisRepositoryPort,
  CostRateData,
  CreateCostAnalysisData,
} from '../repositories/cost-analysis.repository.port'

const yuan = (value: number): bigint => BigInt(Math.round(value * 100))

/** 取自 CNC成本分析.xls 第 1 行 */
export const LINE_ROW_1: CostAnalysisLineDraft = {
  sequence: 1,
  blankType: '铝板料',
  drawingNo: 'BCM-2607 - 12K Live Front Panel V2 REV A',
  drawingVersionId: 'DV1',
  spec: '115*106*19.04',
  revision: 'REV A',
  quantity: '1',
  material: 'AL6061-T6',
  estimatedWeightKg: '1.03',
  netWeightKg: '0.143',
  scrapWeightKg: '0.887',
  scrapUnitPriceMinor: 0n,
  materialUnitPriceMinor: yuan(29),
  materialPriceOverridden: false,
  materialPriceSourceId: 'P2',
  machiningMethod: 'CNC',
  machiningMinutes: '180',
  machiningCostMinor: yuan(180),
  processCosts: {
    deburring: yuan(1.5),
    polishing: 0n,
    surfaceTreatment: yuan(14),
    markingPrinting: yuan(10),
    assembly: yuan(6.4),
    inspectionPacking: yuan(3.8),
  },
  remark: null,
}

/** 取自 CNC成本分析.xls 第 3 行 */
export const LINE_ROW_3: CostAnalysisLineDraft = {
  ...LINE_ROW_1,
  sequence: 2,
  blankType: '型材',
  drawingNo: 'MDU-2001 - Drive Mount - RevA',
  spec: '63*40.83*14',
  material: 'AL6061',
  estimatedWeightKg: '0.048',
  netWeightKg: '0.03',
  scrapWeightKg: '0.018',
  machiningMinutes: '6',
  machiningCostMinor: yuan(6),
  processCosts: {
    deburring: yuan(0.8),
    polishing: 0n,
    surfaceTreatment: yuan(3),
    markingPrinting: 0n,
    assembly: 0n,
    inspectionPacking: yuan(0.8),
  },
  remark: '只加工长度和两侧面以及螺纹',
}

/**
 * 行 id 用全局自增而不是「每条记录从 1 开始」：真实库里 id 是全局唯一的，
 * 派生新版本时新旧两版的行 id 必须能区分开，否则「复制明细」的测试是假绿。
 */
let lineSeq = 0
const nextLineId = (): string => `CAL${(lineSeq += 1)}`

/** 返回拷贝而不是内部对象引用——真实仓储每次查询都是新对象，
 * 若把内部对象直接交出去，调用方后续的写入会「穿透」到之前拿到的快照上，
 * 乐观锁一类的测试就永远测不出问题。 */
function cloneCostAnalysis(record: CostAnalysisRecord): CostAnalysisRecord {
  return { ...record, lines: record.lines.map((line) => ({ ...line })) }
}

export class FakeCostAnalysisRepository implements CostAnalysisRepositoryPort {
  readonly rows: CostAnalysisRecord[] = []

  async findById(id: string): Promise<CostAnalysisRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    return row ? cloneCostAnalysis(row) : null
  }

  async listByCustomer(customerId: string, limit: number): Promise<CostAnalysisRecord[]> {
    return this.rows
      .filter((row) => row.customerId === customerId)
      .slice(0, limit)
      .map(cloneCostAnalysis)
  }

  async create(data: CreateCostAnalysisData): Promise<CostAnalysisRecord> {
    const record: CostAnalysisRecord = {
      id: `CA${this.rows.length + 1}`,
      docNo: data.docNo,
      version: data.version,
      rootId: data.rootId,
      customerId: data.customerId,
      productModel: data.productModel,
      lossBps: data.lossBps,
      overheadBps: data.overheadBps,
      vatBps: data.vatBps,
      currency: data.currency,
      processColumns: data.processColumns,
      status: 'DRAFT',
      preparedBy: data.preparedBy,
      completedAt: null,
      lines: data.lines.map((line) => ({ ...line, id: nextLineId() })),
      versionLock: 0,
    }
    this.rows.push(record)
    return cloneCostAnalysis(record)
  }

  async updateRates(
    id: string,
    versionLock: number,
    rates: CostRateData,
  ): Promise<CostAnalysisRecord | null> {
    const row = this.rows.find(
      (item) => item.id === id && item.versionLock === versionLock && item.status !== 'LOCKED',
    )
    if (!row) return null

    Object.assign(row, rates)
    row.versionLock += 1
    return cloneCostAnalysis(row)
  }

  async replaceLines(
    id: string,
    versionLock: number,
    lines: CostAnalysisLineDraft[],
  ): Promise<CostAnalysisRecord | null> {
    const row = this.rows.find(
      (item) => item.id === id && item.versionLock === versionLock && item.status !== 'LOCKED',
    )
    if (!row) return null

    row.lines = lines.map((line) => ({ ...line, id: nextLineId() }))
    row.versionLock += 1
    return cloneCostAnalysis(row)
  }

  async markCompleted(id: string, versionLock: number, at: Date): Promise<boolean> {
    const row = this.rows.find((item) => item.id === id && item.versionLock === versionLock)
    if (!row) return false

    row.status = 'COMPLETED'
    row.completedAt = at
    row.versionLock += 1
    return true
  }

  async markLocked(id: string): Promise<void> {
    const row = this.rows.find((item) => item.id === id)
    if (row) row.status = 'LOCKED'
  }
}
