import { PENDING_SOURCES, isPanelPending, markPending } from '@machining-erp/shared'

import { ASOF, buildHarness, order, salesReturn, shipment } from './harness'

import type { CostingAnalyticsPort, WmsAnalyticsPort } from '../repositories/upstream-source.ports'

/**
 * 「无数据」与「测得为零」必须分得开——这是本模块最要紧的一条约定。
 *
 * 每个由 stub 撑着的面板都要证明两件事：
 * 1. 行集是空的（**不是一行零值**）；
 * 2. 带着中文的未上线说明。
 *
 * 以及最后一条：真实 provider 一接上，标记自动消失。
 */
describe('未上线的数据源：空行集 + 中文说明，绝不零填', () => {
  it('成本面板整组为空并标明成本模块未上线', async () => {
    const harness = buildHarness()
    const reports = await harness.reports.costReports()

    for (const key of ['elementVariance', 'drill', 'operationVariance', 'costRef'] as const) {
      expect(reports[key]).toEqual([])
      expect(isPanelPending(reports, key)).toBe(true)
      expect(reports.pending?.[key]).toBe(PENDING_SOURCES.COSTING)
    }
  })

  it('备料库存四张表为空并标明仓储模块未上线', async () => {
    const harness = buildHarness()
    const reports = await harness.reports.orderReports()

    for (const key of ['stockProgress', 'stockAging', 'stockConsume', 'stockIdle'] as const) {
      expect(reports[key]).toEqual([])
      expect(reports.pending?.[key]).toBe(PENDING_SOURCES.WMS)
    }
  })

  it('应收账龄为空并标明财务模块未上线', async () => {
    const harness = buildHarness({ orders: [order()] })
    const reports = await harness.reports.salesReports(ASOF)

    expect(reports.arAging).toEqual([])
    expect(reports.pending?.arAging).toBe(PENDING_SOURCES.FINANCE)
  })

  it('工艺分布为空并标明制造执行模块未上线', async () => {
    const harness = buildHarness()
    const reports = await harness.reports.marketReports(ASOF)

    expect(reports.productProcess).toEqual([])
    expect(reports.materialProcess).toEqual([])
    expect(reports.pending?.productProcess).toBe(PENDING_SOURCES.MES)
  })

  it('看板首屏的毛利率是空串而不是 0%——0% 会被当成真实业绩', async () => {
    const harness = buildHarness({ orders: [order()] })
    const view = await harness.overview.overview(ASOF)

    expect(view.headline.marginRate).toBe('')
    expect(view.headline.overdueAr).toBe('')
    expect(view.margins).toEqual([])
    expect(view.pending?.margins).toBe(PENDING_SOURCES.COSTING)
  })

  it('订单结构的毛利率是 null 而不是 0——0 会读成「这类订单不赚钱」', async () => {
    const harness = buildHarness({ orders: [order()] })
    const reports = await harness.reports.orderReports()

    expect(reports.orderType5[0]!.marginRate).toBeNull()
  })
})

describe('真实 provider 接上后标记自动消失', () => {
  const realCosting: CostingAnalyticsPort = {
    elementVariance: async () => [
      { element: '材料', quoted: 100, actual: 120, gapRate: 0.2, orders: 3, share: 1, mainReason: '材料涨价' },
    ],
    costDrill: async () => [],
    operationVariance: async () => [],
    costReference: async () => [],
  }

  it('成本模块上线后，那一格不再带 pending，聚合逻辑一行不动', async () => {
    const harness = buildHarness({}, { costing: realCosting })
    const reports = await harness.reports.costReports()

    expect(reports.elementVariance).toHaveLength(1)
    expect(isPanelPending(reports, 'elementVariance')).toBe(false)
    // 其余仍未上线的格子照旧标记
    expect(reports.pending?.drill).toBe(PENDING_SOURCES.COSTING)
  })

  it('全部上线后 pending 整个消失', async () => {
    const allReal: WmsAnalyticsPort = {
      stockProgress: async () => [
        { docNo: 'STK-1', productName: 'x', planQty: 1, stockedQty: 1, progress: 1, status: 'done' },
      ] as never,
      stockAging: async () => [{}] as never,
      stockConsume: async () => [{}] as never,
      stockIdle: async () => [{}] as never,
    }
    const harness = buildHarness({}, { wms: allReal })
    const reports = await harness.reports.orderReports()

    expect(reports.pending?.stockProgress).toBeUndefined()
    expect(reports.pending?.stockAging).toBeUndefined()
  })
})

describe('markPending 只给真的空面板贴标记', () => {
  it('有数据的面板不贴——真有数据却标着未上线，是另一种说谎', () => {
    const pending = markPending([
      { key: 'a', rows: [1], source: PENDING_SOURCES.COSTING },
      { key: 'b', rows: [], source: PENDING_SOURCES.WMS },
    ])
    expect(pending).toEqual({ b: PENDING_SOURCES.WMS })
  })

  it('全都有数据时整个 pending 字段不出现', () => {
    expect(markPending([{ key: 'a', rows: [1], source: PENDING_SOURCES.MES }])).toBeUndefined()
  })

  it('空清单也不出现', () => {
    expect(markPending([])).toBeUndefined()
  })

  it('isPanelPending 对未标记的键返回 false', () => {
    expect(isPanelPending({ pending: { a: '未上线' } }, 'a')).toBe(true)
    expect(isPanelPending({ pending: { a: '未上线' } }, 'b')).toBe(false)
    expect(isPanelPending(undefined, 'a')).toBe(false)
    expect(isPanelPending({}, 'a')).toBe(false)
  })
})

describe('真实来源的面板完全来自真实数据，不掺 stub', () => {
  it('退货责任分析按行统计——一单两责任要分别落到两行', async () => {
    const mixed = salesReturn({
      lines: [
        { ...salesReturn().lines[0]!, id: 'RL1', sequence: 1, responsibility: 'COMPANY' },
        {
          ...salesReturn().lines[0]!,
          id: 'RL2',
          sequence: 2,
          responsibility: 'SUPPLIER',
          disposition: 'SCRAP',
          amountMinor: 10_000n,
        },
      ],
    })
    const harness = buildHarness({ returns: [mixed] })
    const rows = await harness.rma.byResponsibility()

    expect(rows.map((row) => row.responsibility).sort()).toEqual(['委外 / 供应商不良', '本厂加工不良'])
    expect(rows.every((row) => row.batches === 1)).toBe(true)
  })

  it('日报三条序列都来自真实单据，且不跳过零发生的日子', async () => {
    const harness = buildHarness({ orders: [order()], shipments: [shipment()] })
    const report = await harness.dailyOps.report(ASOF)

    expect(report.rows).toHaveLength(30)
    const received = report.rows.find((row) => row.date === '2026-07-10')
    expect(received?.receivedOrders).toBe(1)
    const shipped = report.rows.find((row) => row.date === '2026-07-20')
    expect(shipped?.shippedOrders).toBe(1)
    // 没有单据的那天照样出现，值为 0——这里的 0 是「当天确实没发生」，不是「没数据」
    const quiet = report.rows.find((row) => row.date === '2026-07-05')
    expect(quiet?.receivedOrders).toBe(0)
  })

  it('无偿补发不计入出货额——与对账单同一条口径', async () => {
    const replacement = shipment({ id: 'SH2', docNo: 'SHP-2', replacesReturnId: 'RMA1' })
    const harness = buildHarness({ shipments: [shipment(), replacement] })
    const report = await harness.dailyOps.report(ASOF)

    const day = report.rows.find((row) => row.date === '2026-07-20')
    expect(day?.shippedOrders).toBe(1)
  })
})
