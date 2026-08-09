import { calculateCostAnalysis } from '../services/cost-analysis-calculator'
import { toCostAnalysisLineDraft, toCostAnalysisLineDrafts } from '../services/cost-analysis-input.mapper'
import { toCostAnalysisView } from '../services/cost-analysis-view.mapper'

import { LINE_ROW_1, LINE_ROW_3 } from './fakes'

import type { CostAnalysisLineDto } from '../dto/cost-analysis-line.dto'
import type { CostAnalysisRecord } from '../repositories/cost-analysis.repository.port'

const RECORD: CostAnalysisRecord = {
  id: 'CA1',
  docNo: 'CST202608080001',
  version: 1,
  rootId: null,
  customerId: 'CU1',
  productModel: 'BCM-2607',
  lossBps: 500,
  overheadBps: 500,
  vatBps: 1300,
  currency: 'CNY',
  processColumns: [{ key: 'deburring', label: '打磨去毛刺' }],
  status: 'COMPLETED',
  preparedBy: 'WFX-2019-0113',
  completedAt: new Date('2026-08-08T10:00:00Z'),
  lines: [
    { ...LINE_ROW_1, id: 'CAL1' },
    { ...LINE_ROW_3, id: 'CAL2' },
  ],
  versionLock: 2,
}

function viewOf(record: CostAnalysisRecord = RECORD) {
  const totals = calculateCostAnalysis(
    record.lines.map((line) => ({
      estimatedWeightKg: line.estimatedWeightKg,
      scrapWeightKg: line.scrapWeightKg,
      materialUnitPriceMinor: line.materialUnitPriceMinor,
      scrapUnitPriceMinor: line.scrapUnitPriceMinor,
      machiningCostMinor: line.machiningCostMinor,
      processCosts: line.processCosts,
    })),
    {
      lossBps: record.lossBps,
      overheadBps: record.overheadBps,
      vatBps: record.vatBps,
      currency: 'CNY',
    },
  )
  return toCostAnalysisView(record, totals)
}

describe('对外表示：金额一律定点字符串 + 币种', () => {
  it('行内金额与合计与样例表一致', () => {
    const view = viewOf()

    expect(view.lines[0]?.materialAmount).toEqual({ amount: '29.87', currency: 'CNY' })
    expect(view.lines[0]?.total).toEqual({ amount: '270.74', currency: 'CNY' })
    expect(view.lines[0]?.totalWithVat).toEqual({ amount: '305.94', currency: 'CNY' })
    expect(view.total).toEqual({ amount: '283.96', currency: 'CNY' })
  })

  it('比率按万分比转成小数展示', () => {
    const view = viewOf()

    expect(view.lossRatio).toBeCloseTo(0.05, 10)
    expect(view.overheadRatio).toBeCloseTo(0.05, 10)
    expect(view.vatRatio).toBeCloseTo(0.13, 10)
  })

  it('工艺列金额逐列转成 Money', () => {
    const view = viewOf()

    expect(view.lines[0]?.processCosts.surfaceTreatment).toEqual({
      amount: '14.00',
      currency: 'CNY',
    })
    expect(view.lines[0]?.processCosts.polishing).toEqual({ amount: '0.00', currency: 'CNY' })
  })

  it('透出版本、状态与乐观锁版本供前端回传', () => {
    const view = viewOf()

    expect(view).toMatchObject({
      docNo: 'CST202608080001',
      version: 1,
      status: 'COMPLETED',
      versionLock: 2,
      preparedBy: 'WFX-2019-0113',
    })
    expect(view.completedAt).toBe('2026-08-08T10:00:00.000Z')
  })

  it('未完成时 completedAt 为 null', () => {
    const view = viewOf({ ...RECORD, status: 'DRAFT', completedAt: null })
    expect(view.completedAt).toBeNull()
  })

  it('行数与计算结果对不上时按 0 兜底而不是崩', () => {
    // 传入空 totals 模拟极端情况：view 仍要能渲染出结构
    const view = toCostAnalysisView(RECORD, {
      lines: [],
      total: { minor: 0n, currency: 'CNY' },
      totalWithVat: { minor: 0n, currency: 'CNY' },
      exact: { total: '0', totalWithVat: '0' },
    })

    expect(view.lines).toHaveLength(2)
    expect(view.lines[0]?.total).toEqual({ amount: '0.00', currency: 'CNY' })
    expect(view.lines[0]?.drawingNo).toBe(LINE_ROW_1.drawingNo)
  })

  it('保留手改材料单价的留痕标记', () => {
    const view = viewOf({
      ...RECORD,
      lines: [{ ...LINE_ROW_1, id: 'CAL1', materialPriceOverridden: true }],
    })
    expect(view.lines[0]?.materialPriceOverridden).toBe(true)
  })
})

describe('入参映射：传输层字符串 → 领域 bigint', () => {
  const DTO: CostAnalysisLineDto = {
    sequence: 1,
    blankType: '铝板料',
    drawingNo: 'BCM-2607',
    drawingVersionId: 'DV1',
    spec: '115*106*19.04',
    revision: 'REV A',
    quantity: '1',
    material: 'AL6061-T6',
    estimatedWeightKg: '1.03',
    netWeightKg: '0.143',
    scrapWeightKg: '0.887',
    scrapUnitPriceMinor: '0',
    materialUnitPriceMinor: '2900',
    materialPriceOverridden: false,
    materialPriceSourceId: 'P2',
    machiningMethod: 'CNC',
    machiningMinutes: '180',
    machiningCostMinor: '18000',
    processCosts: { deburring: '150', surfaceTreatment: '1400' },
    remark: null,
  }

  it('金额字段转成 bigint', () => {
    const draft = toCostAnalysisLineDraft(DTO)

    expect(draft.materialUnitPriceMinor).toBe(2900n)
    expect(draft.machiningCostMinor).toBe(18000n)
    expect(draft.scrapUnitPriceMinor).toBe(0n)
    expect(draft.processCosts).toEqual({ deburring: 150n, surfaceTreatment: 1400n })
  })

  it('重量与数量保持 decimal 字符串，不转数字', () => {
    const draft = toCostAnalysisLineDraft(DTO)

    expect(draft.estimatedWeightKg).toBe('1.03')
    expect(draft.quantity).toBe('1')
    expect(typeof draft.machiningMinutes).toBe('string')
  })

  it('超出 2^53 的分值也不丢精度（用 number 传就会丢）', () => {
    const huge = '9007199254740993' // 2^53 + 1
    const draft = toCostAnalysisLineDraft({ ...DTO, machiningCostMinor: huge })

    expect(draft.machiningCostMinor).toBe(9_007_199_254_740_993n)
    expect(draft.machiningCostMinor.toString()).toBe(huge)
  })

  it('批量映射保持顺序', () => {
    const drafts = toCostAnalysisLineDrafts([DTO, { ...DTO, sequence: 2, drawingNo: 'MDU-2001' }])

    expect(drafts.map((draft) => draft.drawingNo)).toEqual(['BCM-2607', 'MDU-2001'])
  })

  it('空工艺列映射成空对象', () => {
    expect(toCostAnalysisLineDraft({ ...DTO, processCosts: {} }).processCosts).toEqual({})
  })
})
