import { resolveUnitCosts } from '../services/unit-cost'

import { LINE_ROW_1, LINE_ROW_3 } from './fakes'

import type { CostAnalysisRecord } from '../repositories/cost-analysis.repository.port'

function record(lines: CostAnalysisRecord['lines']): CostAnalysisRecord {
  return {
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
    processColumns: [],
    status: 'COMPLETED',
    preparedBy: 'WFX-2019-0113',
    completedAt: null,
    lines,
    versionLock: 0,
  }
}

describe('单件成本由后端从成本分析推导', () => {
  it('数量为 1 时单件成本就是整行合计（对齐样例表 270.74 / 13.22）', () => {
    const costs = resolveUnitCosts(
      record([
        { ...LINE_ROW_1, id: 'CAL1' },
        { ...LINE_ROW_3, id: 'CAL2' },
      ]),
    )

    expect(costs.get('CAL1')).toBe(27_074n)
    expect(costs.get('CAL2')).toBe(1_322n)
  })

  it('按数量摊薄：同一行报 100 件时单件成本是整行合计的百分之一', () => {
    const costs = resolveUnitCosts(record([{ ...LINE_ROW_1, id: 'CAL1', quantity: '100' }]))

    // 27074.0925 / 100 = 270.740925 → 271 分
    expect(costs.get('CAL1')).toBe(271n)
  })

  it('除不尽时四舍五入，不是 bigint 截断', () => {
    const costs = resolveUnitCosts(record([{ ...LINE_ROW_1, id: 'CAL1', quantity: '3' }]))

    // 27074.0925 / 3 = 9024.6975 → 9025；写成 bigint 除法会截断成 9024，一件差一分
    expect(costs.get('CAL1')).toBe(9025n)
  })

  it('成本按不含税口径，税率变了单件成本不动', () => {
    const base = record([{ ...LINE_ROW_1, id: 'CAL1' }])
    const taxed = resolveUnitCosts({ ...base, vatBps: 2500 })

    // 含税金额会变（305.94 是按 13% 算的），但成本口径始终是不含税的 270.74
    expect(taxed.get('CAL1')).toBe(27_074n)
    expect(resolveUnitCosts(base).get('CAL1')).toBe(27_074n)
  })

  it('数量为 0 时退回整行成本，而不是静默当成 0 成本', () => {
    const costs = resolveUnitCosts(record([{ ...LINE_ROW_1, id: 'CAL1', quantity: '0' }]))

    expect(costs.get('CAL1')).toBe(27_074n)
  })

  it('数量为负同样退回整行成本', () => {
    const costs = resolveUnitCosts(record([{ ...LINE_ROW_1, id: 'CAL1', quantity: '-3' }]))

    expect(costs.get('CAL1')).toBe(27_074n)
  })

  it('空成本分析返回空表', () => {
    expect(resolveUnitCosts(record([])).size).toBe(0)
  })

  it('自定义费率会改变单件成本', () => {
    const base = record([{ ...LINE_ROW_1, id: 'CAL1' }])
    const higher = resolveUnitCosts({ ...base, lossBps: 1000, overheadBps: 1000 })

    expect(higher.get('CAL1')).toBeGreaterThan(27_074n)
  })
})
