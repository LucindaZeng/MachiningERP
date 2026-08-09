import {
  BPS_SCALE,
  DEFAULT_PROCESS_COLUMNS,
  DEFAULT_RATES,
  calculateCostAnalysis,
  calculateCostLine,
  type CostLineInput,
} from '../services/cost-analysis-calculator'

/**
 * 基准数据直接取自 example/成本分析/CNC成本分析.xls 的真实行，
 * 期望值是表里算好的数字（元），这里换算成「分」。
 * 这样任何人改动公式，都会立刻被真实报价单的数字打脸。
 */
const yuan = (value: number): bigint => BigInt(Math.round(value * 100))

/** 表内第 1 行：BCM-2607 12K Live Front Panel，铝板料 AL6061-T6 */
const ROW_1: CostLineInput = {
  estimatedWeightKg: '1.03',
  scrapWeightKg: '0.887',
  materialUnitPriceMinor: yuan(29),
  scrapUnitPriceMinor: 0n,
  machiningCostMinor: yuan(180),
  processCosts: {
    deburring: yuan(1.5),
    polishing: 0n,
    surfaceTreatment: yuan(14),
    markingPrinting: yuan(10),
    assembly: yuan(6.4),
    inspectionPacking: yuan(3.8),
  },
}

/** 表内第 3 行：MDU-2001 型材，只加工长度和两侧面 */
const ROW_3: CostLineInput = {
  estimatedWeightKg: '0.048',
  scrapWeightKg: '0.018',
  materialUnitPriceMinor: yuan(29),
  scrapUnitPriceMinor: 0n,
  machiningCostMinor: yuan(6),
  processCosts: {
    deburring: yuan(0.8),
    polishing: 0n,
    surfaceTreatment: yuan(3),
    markingPrinting: 0n,
    assembly: 0n,
    inspectionPacking: yuan(0.8),
  },
}

/** 表内第 4 行：MDU-2001 板料，铝料挖出来成品 */
const ROW_4: CostLineInput = {
  estimatedWeightKg: '0.17',
  scrapWeightKg: '0.14',
  materialUnitPriceMinor: yuan(29),
  scrapUnitPriceMinor: 0n,
  machiningCostMinor: yuan(14),
  processCosts: {
    deburring: yuan(0.4),
    polishing: 0n,
    surfaceTreatment: yuan(3),
    markingPrinting: yuan(0.8),
    assembly: 0n,
    inspectionPacking: yuan(0.8),
  },
}

describe('对齐 CNC成本分析.xls 的真实行', () => {
  it('第 1 行：材料 29.87 / 损耗 12.28 / 管理费 12.89 / 合计 270.74 / 含税 305.94', () => {
    const result = calculateCostLine(ROW_1)

    expect(result.materialAmount.minor).toBe(yuan(29.87))
    expect(result.subtotal.minor).toBe(yuan(245.57))
    expect(result.loss.minor).toBe(yuan(12.28)) // 表内 12.2785，按分取整
    expect(result.overhead.minor).toBe(yuan(12.89)) // 表内 12.892425
    expect(result.total.minor).toBe(yuan(270.74)) // 表内 270.740925
    expect(result.totalWithVat.minor).toBe(yuan(305.94)) // 表内 305.93724525
  })

  it('第 3 行：材料 1.39 / 合计 13.22 / 含税 14.94', () => {
    const result = calculateCostLine(ROW_3)

    expect(result.materialAmount.minor).toBe(yuan(1.39)) // 表内 1.392
    expect(result.processTotal.minor).toBe(yuan(4.6))
    expect(result.total.minor).toBe(yuan(13.22)) // 表内 13.22118
    expect(result.totalWithVat.minor).toBe(yuan(14.94)) // 表内 14.9399334
  })

  it('第 4 行：材料 4.93 / 合计 26.38 / 含税 29.81', () => {
    const result = calculateCostLine(ROW_4)

    expect(result.materialAmount.minor).toBe(yuan(4.93))
    expect(result.total.minor).toBe(yuan(26.38)) // 表内 26.382825
    expect(result.totalWithVat.minor).toBe(yuan(29.81)) // 表内 29.812592249999998
  })

  it('整表合计 = 各行合计之和', () => {
    const result = calculateCostAnalysis([ROW_1, ROW_3, ROW_4])

    expect(result.lines).toHaveLength(3)
    // 270.740925 + 13.22118 + 26.382825 = 310.34493 → 310.34
    // 注意不是「各行取整后再相加」（那样会得到 310.35），全精度累加才和 Excel 一致
    expect(result.total.minor).toBe(yuan(310.34))
  })
})

describe('管理费利润的计算基数（最容易写错的一条）', () => {
  it('按「小计 + 损耗」取，而不是各自对小计取 5%', () => {
    const result = calculateCostLine(ROW_1)

    // 正确：(245.57 + 12.2785) × 5% = 12.892425 → 12.89
    expect(result.overhead.minor).toBe(yuan(12.89))
    // 若错写成 245.57 × 5% = 12.2785 → 12.28，会与表内对不上
    expect(result.overhead.minor).not.toBe(result.loss.minor)
  })

  it('损耗率与管理费率可调，调 0 时两项归零', () => {
    const result = calculateCostLine(ROW_1, { ...DEFAULT_RATES, lossBps: 0, overheadBps: 0 })

    expect(result.loss.minor).toBe(0n)
    expect(result.overhead.minor).toBe(0n)
    expect(result.total.minor).toBe(result.subtotal.minor)
  })

  it('调高损耗率会连带抬高管理费（复利效应）', () => {
    const base = calculateCostLine(ROW_1, DEFAULT_RATES)
    const higher = calculateCostLine(ROW_1, { ...DEFAULT_RATES, lossBps: 1000 })

    expect(higher.loss.minor).toBeGreaterThan(base.loss.minor)
    expect(higher.overhead.minor).toBeGreaterThan(base.overhead.minor)
  })
})

describe('材料金额与余料抵扣', () => {
  it('余料有价时从材料金额里扣减', () => {
    const withScrapValue = calculateCostLine({ ...ROW_1, scrapUnitPriceMinor: yuan(10) })

    // 1.03×29 − 0.887×10 = 29.87 − 8.87 = 21.00
    expect(withScrapValue.materialAmount.minor).toBe(yuan(21))
  })

  it('余料单价为 0 时等于不抵扣（样例表的口径）', () => {
    expect(calculateCostLine(ROW_1).materialAmount.minor).toBe(yuan(29.87))
  })

  it('重量用 decimal 字符串，不会出现浮点误差', () => {
    const result = calculateCostLine({
      ...ROW_1,
      estimatedWeightKg: '0.1',
      scrapWeightKg: '0.2',
      materialUnitPriceMinor: yuan(3),
      scrapUnitPriceMinor: yuan(1),
    })
    // 0.1×3 − 0.2×1 = 0.3 − 0.2 = 0.10（浮点算会得到 0.09999999999999998）
    expect(result.materialAmount.minor).toBe(yuan(0.1))
  })
})

describe('工艺列可自由加减', () => {
  it('默认列取自样例表表头', () => {
    expect(DEFAULT_PROCESS_COLUMNS.map((column) => column.label)).toEqual([
      '打磨去毛刺',
      '抛光',
      '表面处理',
      '镭雕丝印',
      '组合安装销钉',
      '全检包装运输',
    ])
  })

  it('新增自定义工艺列直接进入小计', () => {
    const withExtra = calculateCostLine({
      ...ROW_3,
      processCosts: { ...ROW_3.processCosts, heatTreatment: yuan(5) },
    })
    const base = calculateCostLine(ROW_3)

    expect(withExtra.processTotal.minor).toBe(base.processTotal.minor + yuan(5))
  })

  it('一个工艺列都没有时按 0 计', () => {
    const result = calculateCostLine({ ...ROW_3, processCosts: {} })
    expect(result.processTotal.minor).toBe(0n)
    expect(result.subtotal.minor).toBe(result.materialAmount.minor + ROW_3.machiningCostMinor)
  })
})

describe('中间不取整（与 Excel 的满精度口径一致）', () => {
  it('第 4 行按全精度算是 26.38，逐步取整会算成 26.39', () => {
    const result = calculateCostLine(ROW_4)

    expect(result.total.minor).toBe(yuan(26.38))
    // 若每步取整：小计 23.93 → 损耗 1.20 → 管理费 1.26 → 合计 26.39
    expect(result.subtotal.minor + result.loss.minor + result.overhead.minor).toBe(yuan(26.39))
  })

  it('exact 保留全精度，供汇总与比价继续参与计算', () => {
    const result = calculateCostLine(ROW_1)

    expect(result.exact.total).toBe('27074.0925')
    expect(result.exact.totalWithVat).toBe('30593.724525')
  })
})

describe('边界', () => {
  it('空表合计为 0 而不是崩', () => {
    const result = calculateCostAnalysis([])

    expect(result.lines).toEqual([])
    expect(result.total).toEqual({ minor: 0n, currency: 'CNY' })
    expect(result.totalWithVat).toEqual({ minor: 0n, currency: 'CNY' })
  })

  it('税率 0 时含税等于不含税', () => {
    const result = calculateCostLine(ROW_3, { ...DEFAULT_RATES, vatBps: 0 })
    expect(result.totalWithVat.minor).toBe(result.total.minor)
  })

  it('BPS_SCALE 是万分比基数', () => {
    expect(BPS_SCALE).toBe(10_000)
    expect(DEFAULT_RATES).toMatchObject({ lossBps: 500, overheadBps: 500, vatBps: 1300 })
  })
})
