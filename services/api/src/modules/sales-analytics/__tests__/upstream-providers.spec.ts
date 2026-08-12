import {
  StubCostingAnalyticsAdapter,
  StubFinanceAnalyticsAdapter,
  StubMesAnalyticsAdapter,
  StubWmsAnalyticsAdapter,
} from '../repositories/stub-upstream.adapters'

import { ASOF, buildHarness, order, salesReturn, shipment } from './harness'

import type {
  CostingAnalyticsPort,
  FinanceAnalyticsPort,
  MesAnalyticsPort,
  WmsAnalyticsPort,
} from '../repositories/upstream-source.ports'

/** 四个 stub 的语义就是「空行集」。这一组把它钉死。 */
describe('上游 STUB：一律空行集，绝不返回零值行', () => {
  it('成本 stub 四个方法全空', async () => {
    const stub = new StubCostingAnalyticsAdapter()
    expect(await stub.elementVariance()).toEqual([])
    expect(await stub.costDrill()).toEqual([])
    expect(await stub.operationVariance()).toEqual([])
    expect(await stub.costReference()).toEqual([])
  })

  it('财务、仓储、制造 stub 同样全空', async () => {
    expect(await new StubFinanceAnalyticsAdapter().arAging()).toEqual([])

    const wms = new StubWmsAnalyticsAdapter()
    expect(await wms.stockProgress()).toEqual([])
    expect(await wms.stockAging()).toEqual([])
    expect(await wms.stockConsume()).toEqual([])
    expect(await wms.stockIdle()).toEqual([])

    const mes = new StubMesAnalyticsAdapter()
    expect(await mes.productProcess()).toEqual([])
    expect(await mes.materialProcess()).toEqual([])
  })

  it('反复调用不重复打 warn——分析接口会被轮询，每次都打会淹掉日志', async () => {
    const stub = new StubCostingAnalyticsAdapter()
    const spy = jest.spyOn((stub as unknown as { logger: { warn: jest.Mock } }).logger, 'warn')

    await stub.elementVariance()
    await stub.costDrill()
    await stub.operationVariance()

    expect(spy).toHaveBeenCalledTimes(1)
  })
})

/**
 * 四个域各自接上真实 provider 时，对应面板要有数据且不再带 pending。
 * 这是「上线时只换 provider、聚合逻辑一行不动」这条承诺的验证。
 */
describe('真实 provider 替换后各报表的表现', () => {
  const costing: CostingAnalyticsPort = {
    elementVariance: async () => [
      { element: '材料', quoted: 100, actual: 120, gapRate: 0.2, orders: 3, share: 1, mainReason: '涨价' },
    ],
    costDrill: async () => [{ dummy: true }] as never,
    operationVariance: async () => [{ dummy: true }] as never,
    costReference: async () => [{ dummy: true }] as never,
  }
  const finance: FinanceAnalyticsPort = {
    arAging: async () =>
      [{ customer: 'C1', notDue: 1, d1to30: 0, d31to60: 0, d61to90: 0, over90: 0 }] as never,
  }
  const mes: MesAnalyticsPort = {
    productProcess: async () => [{ dummy: true }] as never,
    materialProcess: async () => [{ dummy: true }] as never,
  }
  const wms: WmsAnalyticsPort = {
    stockProgress: async () => [{ dummy: true }] as never,
    stockAging: async () => [{ dummy: true }] as never,
    stockConsume: async () => [{ dummy: true }] as never,
    stockIdle: async () => [{ dummy: true }] as never,
  }

  it('成本模块上线：成本报表四格全部有数据且无 pending', async () => {
    const harness = buildHarness({}, { costing })
    const reports = await harness.reports.costReports()

    expect(reports.elementVariance).toHaveLength(1)
    expect(reports.pending).toBeUndefined()
  })

  it('财务模块上线：应收账龄有数据且不再标 pending', async () => {
    const harness = buildHarness({ orders: [order()] }, { finance })
    const reports = await harness.reports.salesReports(ASOF)

    expect(reports.arAging).toHaveLength(1)
    expect(reports.pending?.arAging).toBeUndefined()
    // 成本相关的几格仍然标着
    expect(reports.pending?.costVariance).toBeDefined()
  })

  it('制造模块上线：工艺分布有数据', async () => {
    const harness = buildHarness({}, { mes })
    const reports = await harness.reports.marketReports(ASOF)

    expect(reports.productProcess).toHaveLength(1)
    expect(reports.materialProcess).toHaveLength(1)
    expect(reports.pending?.productProcess).toBeUndefined()
  })

  it('仓储模块上线：备料四表有数据，只剩资金占用那一格仍待补', async () => {
    const harness = buildHarness({}, { wms })
    const reports = await harness.reports.orderReports()

    expect(reports.stockProgress).toHaveLength(1)
    expect(reports.pending?.stockProgress).toBeUndefined()
    expect(reports.pending?.stockCapital).toBeDefined()
  })

  it('四个域全部上线后，六大类报表里只剩本就没有来源的那几格', async () => {
    const harness = buildHarness({ orders: [order()] }, { costing, finance, mes, wms })
    const reports = await harness.reports.salesReports(ASOF)

    expect(reports.pending?.arAging).toBeUndefined()
    expect(reports.pending?.costVariance).toBeUndefined()
    expect(reports.pending?.processMix).toBeUndefined()
    // customerMargin / productMargin / priceTrend / materialMix 的行集在本层恒为空，
    // 因此仍然带着标记——它们要等各自模块补上取数，不是换个 provider 就有的
    expect(reports.pending?.customerMargin).toBeDefined()
  })
})

describe('端到端：三份真实单据同时在场', () => {
  it('六个端点都不炸，且真实面板确实有数据', async () => {
    const harness = buildHarness({
      orders: [order(), order({ id: 'O2', docNo: 'SO-2', orderType: 'SAMPLE', customerId: 'C2' })],
      shipments: [shipment()],
      returns: [salesReturn()],
    })

    const [overview, sales, cost, orders, market, daily] = await Promise.all([
      harness.overview.overview(ASOF),
      harness.reports.salesReports(ASOF),
      harness.reports.costReports(),
      harness.reports.orderReports(),
      harness.reports.marketReports(ASOF),
      harness.dailyOps.report(ASOF),
    ])

    expect(overview.trend).toHaveLength(12)
    expect(overview.orderMix.length).toBe(2)
    expect(sales.orderTrend.length).toBeGreaterThan(0)
    expect(cost.threshold.warn).toBe(0.05)
    expect(orders.orderType5.length).toBe(2)
    expect(market.rmaResponsibility.length).toBe(1)
    expect(daily.rows).toHaveLength(30)
    expect(daily.caliber).toContain('ORD-02')
  })

  it('工作台在三类待办同时存在时都列出来', async () => {
    const harness = buildHarness({
      orders: [order({ status: 'MANAGER_REVIEW' })],
      shipments: [shipment({ status: 'PACKED', shippedAt: null })],
      returns: [salesReturn({ status: 'REGISTERED' })],
    })
    const view = await harness.workbench.workbench('WFX-2018-0042', ASOF)

    const categories = new Set(view.todos.map((todo) => todo.category))
    expect(categories.has('订单待审核')).toBe(true)
    expect(categories.has('待出运')).toBe(true)
    expect(categories.has('客诉待响应')).toBe(true)
  })
})
