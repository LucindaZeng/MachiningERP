import { DocTimelineService } from '../../../platform/timeline'
import { SalesOrderService } from '../../contract-order'
import { SalesReturnService } from '../../sales-return'
import { SlaAnalyticsService } from '../services/sla-analytics.service'

import { ASOF, buildHarness, order, salesReturn, shipment } from './harness'

import type { TimelineNodeRecord } from '../../../platform/timeline'

function node(overrides: Partial<TimelineNodeRecord> = {}): TimelineNodeRecord {
  return {
    id: 'T1',
    docType: 'SO',
    docId: 'O1',
    node: 'ORD-02 业务经理审核',
    sequence: 1,
    status: 'DONE',
    enteredAt: new Date(2026, 6, 9, 9, 0),
    leftAt: new Date(2026, 6, 9, 12, 0),
    durationMs: 10_800_000n,
    ownerUserCode: 'WFX-2018-0042',
    ownerDept: '业务部',
    remark: null,
    ...overrides,
  } as TimelineNodeRecord
}

function buildSla(nodes: TimelineNodeRecord[], orders = [order()], returns = [salesReturn()]) {
  const timeline = { list: jest.fn(async () => nodes) } as unknown as DocTimelineService
  const orderService = {
    list: jest.fn(async (query: { orderType?: string }) =>
      orders.filter((item) => !query.orderType || item.orderType === query.orderType),
    ),
  } as unknown as SalesOrderService
  const returnService = { list: jest.fn(async () => returns) } as unknown as SalesReturnService
  return new SlaAnalyticsService(timeline, orderService, returnService)
}

describe('审核时效：耗时取平台算好的 durationMs，不自己减时间戳', () => {
  it('按单据与节点分组，给出均值、P90 与超期率', async () => {
    const sla = buildSla([node()])
    const rows = await sla.nodeSla()

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ doc: '销售订单', node: 'ORD-02 业务经理审核', avgHours: 3 })
    expect(rows[0]!.overdueRate).toBe(0)
  })

  it('超过 24 小时的节点计入超期率', async () => {
    const slow = node({ durationMs: 172_800_000n })
    const sla = buildSla([slow])
    const rows = await sla.nodeSla()

    expect(rows[0]!.avgHours).toBe(48)
    expect(rows[0]!.overdueRate).toBe(1)
  })

  it('未关闭的节点没有 durationMs，不参与统计——**不是按 0 小时算**', async () => {
    const open = node({ leftAt: null, durationMs: null })
    const sla = buildSla([open])
    expect(await sla.nodeSla()).toEqual([])
  })

  it('没有节点记录时整表为空', async () => {
    const sla = buildSla([])
    expect(await sla.nodeSla()).toEqual([])
  })

  it('没有部门时回落到占位符而不是空白', async () => {
    const sla = buildSla([node({ ownerDept: null })])
    expect((await sla.nodeSla())[0]!.owner).toBe('—')
  })

  it('未登记的单据类型原样透出编码，不硬套一个中文名', async () => {
    const sla = buildSla([node({ docType: 'XYZ' })])
    expect((await sla.nodeSla())[0]!.doc).toBe('XYZ')
  })

  it('审批效率卡由节点表推导，退回率暂为 0（timeline 上没有退回语义）', async () => {
    const sla = buildSla([node()])
    const rows = await sla.approvalEfficiency()

    expect(rows[0]).toMatchObject({ node: '销售订单 · ORD-02 业务经理审核', returnRate: 0 })
    expect(rows[0]!.onTimeRate).toBe(1)
  })

  it('备料订单审批时效：审批人留占位符——订单头上只有 approvedAt，没有 approvedBy', async () => {
    const stock = order({
      orderType: 'STOCK_PREP',
      estimatedCostMinor: 500_000_00n,
      submittedAt: new Date(2026, 6, 1, 0, 0),
      approvedAt: new Date(2026, 6, 2, 0, 0),
    })
    const sla = buildSla([], [stock])
    const rows = await sla.stockApprovals()

    expect(rows[0]).toMatchObject({ hours: 24, approver: '—' })
  })

  it('未提交或未批准的备料订单不进时效表', async () => {
    const draft = order({ orderType: 'STOCK_PREP', submittedAt: null, approvedAt: null })
    const sla = buildSla([], [draft])
    expect(await sla.stockApprovals()).toEqual([])
  })
})

describe('报表组装：真实面板与待上线面板不混合', () => {
  it('六大类报表里真实的那几格有数据，依赖上游的那几格为空', async () => {
    const harness = buildHarness({
      orders: [order()],
      shipments: [shipment()],
      returns: [salesReturn()],
    })
    const reports = await harness.reports.salesReports(ASOF)

    // 真实来源
    expect(reports.orderMix.length).toBeGreaterThan(0)
    expect(reports.customerRank.length).toBeGreaterThan(0)
    expect(reports.rmaStats.length).toBeGreaterThan(0)
    expect(reports.invoiceReceivable.length).toBeGreaterThan(0)
    // 待上游
    expect(reports.costVariance).toEqual([])
    expect(reports.productMargin).toEqual([])
    expect(reports.priceTrend).toEqual([])
  })

  it('订单报表里 backlog 与样品来自真实数据，备料四表待仓储', async () => {
    const harness = buildHarness({ orders: [order()] })
    const reports = await harness.reports.orderReports()

    expect(reports.orderType5.length).toBeGreaterThan(0)
    expect(reports.backlogCustomer.length).toBeGreaterThan(0)
    expect(reports.stockCapital.note).toContain('待仓储模块上线')
  })

  it('市场报表里流失与退货责任来自真实数据', async () => {
    const stale = order({ approvedAt: new Date(2026, 0, 1) })
    const harness = buildHarness({ orders: [stale], returns: [salesReturn()] })
    const reports = await harness.reports.marketReports(ASOF)

    expect(reports.churn.length).toBeGreaterThan(0)
    expect(reports.rmaResponsibility.length).toBeGreaterThan(0)
    expect(reports.shipBlockers).toEqual([])
  })

  it('成本报表的审核时效来自平台节点计时，是真实数据', async () => {
    const harness = buildHarness({ orders: [order()] })
    const reports = await harness.reports.costReports()

    expect(reports.threshold).toMatchObject({ warn: 0.05, alert: 0.1 })
    // 本 harness 的 timeline 返回空，因此节点表为空，但它不带 pending——
    // 「没有节点记录」与「模块没上线」是两回事
    expect(reports.slaNodes).toEqual([])
    expect(reports.pending?.slaNodes).toBeUndefined()
  })

  it('全空数据源下不炸，且每张待上游的表都带说明', async () => {
    const harness = buildHarness()
    const reports = await harness.reports.salesReports(ASOF)

    expect(reports.quoteFunnel.length).toBeGreaterThan(0)
    expect(Object.keys(reports.pending ?? {}).length).toBeGreaterThan(0)
  })
})
