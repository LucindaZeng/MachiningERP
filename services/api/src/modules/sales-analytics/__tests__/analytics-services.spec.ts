import { backlogBucketOf, churnRiskOf, gradeOf } from '../constants/analytics-labels'
import {
  averageIntervalDays,
  frequencyChange,
} from '../services/customer-analytics.service'
import { openOrdersAt, orderAmountMinor, orderQty } from '../services/daily-ops.service'
import { deliveryDueIndex, shippedQtyIndex } from '../services/delivery-analytics.service'
import { earliestDueOf, isBacklog } from '../services/order-analytics.service'
import { percentile } from '../services/sla-analytics.service'

import { ASOF, buildHarness, order, salesReturn, shipment } from './harness'

import type { SalesOrderRecord } from '../../contract-order'

describe('订单金额与数量：单头没有总额，只能逐行算', () => {
  it('金额 = 数量 × 单价，逐行相加', () => {
    expect(orderAmountMinor(order())).toBe(249_000n)
  })

  it('多行相加', () => {
    const two = order({
      lines: [
        { ...order().lines[0]!, id: 'a', quantity: '10.000000', unitPriceMinor: 100n },
        { ...order().lines[0]!, id: 'b', quantity: '5.000000', unitPriceMinor: 200n },
      ],
    })
    expect(orderAmountMinor(two)).toBe(2_000n)
    expect(orderQty(two)).toBe(15)
  })

  it('空行订单金额为 0', () => {
    expect(orderAmountMinor(order({ lines: [] }))).toBe(0n)
  })
})

describe('在手订单判据', () => {
  it.each([
    ['APPROVED', true],
    ['EXECUTING', true],
    ['COMPLETED', false],
    ['DRAFT', false],
    ['MANAGER_REVIEW', false],
  ] as const)('%s → 在手 %s', (status, expected) => {
    expect(isBacklog(order({ status }) as SalesOrderRecord)).toBe(expected)
  })

  it('日终存量只算当日或之前批过的', () => {
    const early = order({ id: 'A', approvedAt: new Date(2026, 6, 1) })
    const late = order({ id: 'B', approvedAt: new Date(2026, 6, 20) })
    const open = openOrdersAt([early, late], new Date(2026, 6, 10, 23, 59))
    expect(open.map((item) => item.id)).toEqual(['A'])
  })

  it('没批过的不算存量——草稿不占产能', () => {
    const draft = order({ status: 'DRAFT', approvedAt: null })
    expect(openOrdersAt([draft], new Date(2026, 6, 30))).toEqual([])
  })

  it('最近交期取各行最早的一个', () => {
    const multi = order({
      lines: [
        { ...order().lines[0]!, id: 'a', deliveryDate: new Date(2026, 7, 1) },
        { ...order().lines[0]!, id: 'b', deliveryDate: new Date(2026, 6, 15) },
      ],
    })
    expect(earliestDueOf(multi)).toEqual(new Date(2026, 6, 15))
  })

  it('全行无交期时返回 null——不是「今天到期」', () => {
    const undated = order({ lines: [{ ...order().lines[0]!, deliveryDate: null }] })
    expect(earliestDueOf(undated)).toBeNull()
  })
})

describe('在手订单分桶', () => {
  it.each([
    [-1, '已超期'],
    [0, '7 天内'],
    [7, '7 天内'],
    [8, '8-30 天'],
    [30, '8-30 天'],
    [31, '31-60 天'],
    [61, '60 天以上'],
  ])('剩余 %s 天 → %s', (days, bucket) => {
    expect(backlogBucketOf(days)).toBe(bucket)
  })

  it('没有交期单独成桶——不能藏进「60 天以上」那个看着很从容的格子', () => {
    expect(backlogBucketOf(null)).toBe('无交期')
  })
})

describe('客户分级与流失判定', () => {
  it.each([
    [0.5, 'A'],
    [0.8, 'A'],
    [0.9, 'B'],
    [0.95, 'B'],
    [0.99, 'C'],
  ] as const)('累计占比 %s → %s 级', (share, grade) => {
    expect(gradeOf(share)).toBe(grade)
  })

  it.each([
    [10, 'normal'],
    [60, 'watch'],
    [119, 'watch'],
    [120, 'churn'],
  ] as const)('%s 天未下单 → %s', (days, risk) => {
    expect(churnRiskOf(days)).toBe(risk)
  })
})

describe('客户下单节奏', () => {
  function history(dates: Date[]) {
    return {
      customerId: 'C1',
      orders: dates.map((date) => order({ approvedAt: date })),
      amountMinor: 0n,
      firstAt: dates[0] ?? null,
      lastAt: dates[dates.length - 1] ?? null,
    }
  }

  it('只下过一次单时没有间隔可言，返回 null', () => {
    expect(averageIntervalDays(history([new Date(2026, 6, 1)]))).toBeNull()
  })

  it('多次下单时算平均间隔', () => {
    const value = averageIntervalDays(
      history([new Date(2026, 6, 1), new Date(2026, 6, 11), new Date(2026, 6, 21)]),
    )
    expect(value).toBe(10)
  })

  it('单据太少时不给频次结论——两三张单算不出趋势', () => {
    expect(frequencyChange(history([new Date(2026, 6, 1), new Date(2026, 6, 5)]))).toBe(0)
  })

  it('够多时给出前后半段的对比', () => {
    const value = frequencyChange(
      history([
        new Date(2026, 5, 1),
        new Date(2026, 5, 10),
        new Date(2026, 6, 1),
        new Date(2026, 6, 10),
        new Date(2026, 6, 20),
      ]),
    )
    expect(typeof value).toBe('number')
  })
})

describe('交付索引', () => {
  it('订单行 → 交期', () => {
    expect(deliveryDueIndex([order()]).get('OL1')).toEqual(new Date(2026, 6, 25))
  })

  it('无交期的行不进索引——不能拿一个默认日期当交期判准交', () => {
    const undated = order({ lines: [{ ...order().lines[0]!, deliveryDate: null }] })
    expect(deliveryDueIndex([undated]).size).toBe(0)
  })

  it('累计已发数按订单行汇总', () => {
    const second = shipment({ id: 'SH2', docNo: 'S2' })
    expect(shippedQtyIndex([shipment(), second]).get('OL1')).toBe(200)
  })

  it('未发出与无偿补发都不计入已发数', () => {
    const planned = shipment({ id: 'SH2', shippedAt: null })
    const replacement = shipment({ id: 'SH3', replacesReturnId: 'RMA1' })
    expect(shippedQtyIndex([planned, replacement]).size).toBe(0)
  })
})

describe('准交与部分出货', () => {
  it('按客户统计准交率，迟到的单独计数', async () => {
    const late = shipment({ id: 'SH2', shippedAt: new Date(2026, 6, 30) })
    const harness = buildHarness({ orders: [order()], shipments: [shipment(), late] })
    const rows = await harness.delivery.onTimeByCustomer()

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ customer: 'C1', total: 2, late: 1, rate: 0.5 })
  })

  it('没有可判定的行时整表为空——不是 0%', async () => {
    const undated = order({ lines: [{ ...order().lines[0]!, deliveryDate: null }] })
    const harness = buildHarness({ orders: [undated], shipments: [shipment()] })
    expect(await harness.delivery.onTimeByCustomer()).toEqual([])
  })

  it('全部准交时迟交原因为空', async () => {
    const harness = buildHarness({ orders: [order()], shipments: [shipment()] })
    expect(await harness.delivery.lateReasons()).toEqual([])
  })

  it('有迟交时给出一条汇总，并说明细分待生产与品质模块', async () => {
    const late = shipment({ shippedAt: new Date(2026, 6, 30) })
    const harness = buildHarness({ orders: [order()], shipments: [late] })
    const reasons = await harness.delivery.lateReasons()

    expect(reasons).toHaveLength(1)
    expect(reasons[0]!.reason).toContain('待生产与品质模块上线')
  })

  it('发了一半才算部分出货；一件没发的不算', async () => {
    const half = shipment({ lines: [{ ...shipment().lines[0]!, shippedQty: '40.000000' }] })
    const harness = buildHarness({ orders: [order()], shipments: [half] })
    const rows = await harness.delivery.partialShipments()

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ orderQty: 100, shippedQty: 40, remainQty: 60 })

    const nothing = buildHarness({ orders: [order()], shipments: [] })
    expect(await nothing.delivery.partialShipments()).toEqual([])
  })

  it('出货达成按月对比计划与实际', async () => {
    const harness = buildHarness({ orders: [order()], shipments: [shipment()] })
    const rows = await harness.delivery.achievement()
    expect(rows.map((row) => row.month)).toContain('2026-07')
  })

  it('客户维度出货占比', async () => {
    const harness = buildHarness({ shipments: [shipment()] })
    const rows = await harness.delivery.shareByCustomer()
    expect(rows[0]).toMatchObject({ customerId: 'C1', share: 1 })
  })
})

describe('订单结构与趋势', () => {
  it('按类型分组并给中文名', async () => {
    const sample = order({ id: 'O2', orderType: 'SAMPLE' })
    const harness = buildHarness({ orders: [order(), sample] })
    const rows = await harness.orders.orderType5()

    expect(rows.map((row) => row.type).sort()).toEqual(['样品订单', '正式业务订单'])
  })

  it('趋势按月归集，首月无上期时环比为 0', async () => {
    const harness = buildHarness({ orders: [order()] })
    const rows = await harness.orders.orderTrend()
    expect(rows[0]).toMatchObject({ month: '2026-07', count: 1, mom: 0, yoy: 0 })
  })

  it('backlog 分桶与按月、按客户、按产品三个维度', async () => {
    const harness = buildHarness({ orders: [order()] })
    expect(await harness.orders.backlogBuckets()).toHaveLength(1)
    expect(await harness.orders.backlogByMonth()).toHaveLength(1)
    expect((await harness.orders.backlogByCustomer())[0]).toMatchObject({ name: 'C1', orders: 1 })
    expect((await harness.orders.backlogByProduct())[0]!.name).toBe('铝合金探头支架')
  })

  it('无交期的在手订单在按月表里不出现，但在分桶里进「无交期」', async () => {
    const undated = order({ lines: [{ ...order().lines[0]!, deliveryDate: null }] })
    const harness = buildHarness({ orders: [undated] })
    expect(await harness.orders.backlogByMonth()).toEqual([])
    expect((await harness.orders.backlogBuckets())[0]!.bucket).toBe('无交期')
  })

  it('临期预警只列窗口内的，超期标 late', async () => {
    const overdue = order({ lines: [{ ...order().lines[0]!, deliveryDate: new Date(2026, 5, 1) }] })
    const harness = buildHarness({ orders: [overdue] })
    const alerts = await harness.orders.backlogAlerts(7)

    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.level).toBe('late')
  })
})

describe('报价与样品转化', () => {
  it('漏斗给出订单侧看得到的三段', async () => {
    const harness = buildHarness({ orders: [order()] })
    const funnel = await harness.quotes.funnel()
    expect(funnel.map((row) => row.stage)).toEqual(['已转化报价', '已下单', '已审核通过'])
  })

  it('未成交原因如实返回空——订单侧看不到没成交的报价', async () => {
    const harness = buildHarness({ orders: [order()] })
    expect(await harness.quotes.lostReasons()).toEqual([])
  })

  it('周期表给出提交到审核那一段，超 SLA 标红', async () => {
    const slow = order({
      submittedAt: new Date(2026, 6, 1, 0, 0),
      approvedAt: new Date(2026, 6, 3, 0, 0),
    })
    const harness = buildHarness({ orders: [slow] })
    const rows = await harness.quotes.cycle()

    expect(rows[0]!.totalHours).toBe(48)
    expect(rows[0]!.overdue).toBe(true)
  })

  it('样品转化：同客户后来下了正式单才算转化', async () => {
    const sample = order({ id: 'O2', orderType: 'SAMPLE' })
    const harness = buildHarness({ orders: [order(), sample] })
    const conversion = await harness.quotes.sampleConversion()

    expect(conversion).toMatchObject({ samples: 1, converted: 1, rate: 1 })
  })

  it('没有样品订单时转化率为 0 而不是 NaN', async () => {
    const harness = buildHarness({ orders: [order()] })
    expect((await harness.quotes.sampleConversion()).rate).toBe(0)
    expect(await harness.quotes.sampleCycle()).toEqual([])
  })

  it('按业务员与按产品分组', async () => {
    const harness = buildHarness({ orders: [order()] })
    expect((await harness.quotes.byOwner())[0]!.name).toBe('WFX-2018-0042')
    expect((await harness.quotes.byMaterial())[0]!.name).toBe('铝合金探头支架')
  })
})

describe('客户分析', () => {
  it('排行带占比与累计占比分级', async () => {
    const harness = buildHarness({ orders: [order()] })
    const rows = await harness.customers.ranking()
    expect(rows[0]).toMatchObject({ customer: 'C1', share: 1, grade: 'C' })
  })

  it('活跃度按最后下单日排序', async () => {
    const harness = buildHarness({ orders: [order()] })
    const rows = await harness.customers.activity(ASOF)
    expect(rows[0]!.daysSince).toBe(18)
  })

  it('流失预警只列观察与流失，正常客户不占版面', async () => {
    const harness = buildHarness({ orders: [order()] })
    expect(await harness.customers.churn(ASOF)).toEqual([])

    const stale = order({ approvedAt: new Date(2026, 0, 1) })
    const churning = buildHarness({ orders: [stale] })
    const rows = await churning.customers.churn(ASOF)
    expect(rows[0]!.level).toBe('churn')
  })

  it('新客户按首单日筛选', async () => {
    const harness = buildHarness({ orders: [order()] })
    expect(await harness.customers.newCustomers(new Date(2026, 0, 1))).toHaveLength(1)
    expect(await harness.customers.newCustomers(new Date(2026, 11, 1))).toEqual([])
  })

  it('三段勾稽：已开票看得出来，回款一律 false 并由上层标 pending', async () => {
    const harness = buildHarness({ shipments: [shipment()] })
    const rows = await harness.customers.invoiceReceivable(ASOF)
    expect(rows[0]).toMatchObject({ invoiced: false, received: false })
  })
})

describe('P90', () => {
  it('空集返回 0（调用方已按 avgHours > 0 过滤）', () => {
    expect(percentile([], 0.9)).toBe(0)
  })

  it('取排序后的分位值', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(10)
    expect(percentile([5], 0.9)).toBe(5)
  })
})

describe('客诉分析', () => {
  it('按不良现象归集批数、数量与金额', async () => {
    const harness = buildHarness({ returns: [salesReturn()] })
    const rows = await harness.rma.statsByReason()
    expect(rows[0]).toMatchObject({ reason: '平面度超差', batches: 1, quantity: 10 })
  })

  it('重复问题要出现两次以上才算', async () => {
    const harness = buildHarness({ returns: [salesReturn()] })
    expect(await harness.rma.repeatIssues()).toEqual([])

    const twice = buildHarness({
      returns: [salesReturn(), salesReturn({ id: 'RMA2', docNo: 'RMA-2' })],
    })
    const rows = await twice.rma.repeatIssues()
    expect(rows[0]).toMatchObject({ times: 2, status: '已全部结案' })
  })

  it('首响达标率：没有客诉时返回 null 而不是 100%', async () => {
    const empty = buildHarness()
    expect(await empty.rma.responseRate(2)).toBeNull()

    const harness = buildHarness({ returns: [salesReturn()] })
    expect(await harness.rma.responseRate(2)).toBe(1)
  })

  it('超过 SLA 的不计入达标', async () => {
    const slow = salesReturn({ respondedAt: new Date(2026, 6, 26, 20, 0) })
    const harness = buildHarness({ returns: [slow] })
    expect(await harness.rma.responseRate(2)).toBe(0)
  })
})

describe('工作台', () => {
  it('待办来自单据真实状态，不另建待办表', async () => {
    const pending = order({ status: 'MANAGER_REVIEW' })
    const harness = buildHarness({ orders: [pending], returns: [salesReturn({ status: 'REGISTERED' })] })
    const view = await harness.workbench.workbench('WFX-2018-0042', ASOF)

    expect(view.todos.some((todo) => todo.category === '订单待审核')).toBe(true)
    expect(view.todos.some((todo) => todo.category === '客诉待响应')).toBe(true)
  })

  it('KPI 卡里没有毛利与应收——那两块要等成本与财务，标在 pending 上', async () => {
    const harness = buildHarness({ orders: [order()] })
    const view = await harness.workbench.workbench('WFX-2018-0042', ASOF)

    expect(view.kpis.map((card) => card.key)).toEqual(['monthOrders', 'backlog'])
    expect(view.pending?.['kpis.margin']).toBeDefined()
  })

  it('有客诉时才出现首响达标率卡', async () => {
    const harness = buildHarness({ orders: [order()], returns: [salesReturn()] })
    const view = await harness.workbench.workbench('WFX-2018-0042', ASOF)
    expect(view.kpis.map((card) => card.key)).toContain('rmaResponse')
  })

  it('等待超过 24 小时的待办标 overdue', async () => {
    const stale = order({ status: 'MANAGER_REVIEW', submittedAt: new Date(2026, 6, 1) })
    const harness = buildHarness({ orders: [stale] })
    const view = await harness.workbench.workbench('WFX-2018-0042', ASOF)
    expect(view.todos[0]!.level).toBe('overdue')
  })
})

describe('看板首屏', () => {
  it('同比无上期数据时留空而不是 0%', async () => {
    const harness = buildHarness({ orders: [order()] })
    const view = await harness.overview.overview(ASOF)
    expect(view.headline.ytdGrowth).toBe('')
  })

  it('有上期数据时算出同比', async () => {
    const lastYear = order({ id: 'O0', approvedAt: new Date(2025, 6, 10) })
    const harness = buildHarness({ orders: [order(), lastYear] })
    const view = await harness.overview.overview(ASOF)
    expect(view.headline.ytdGrowth).toBe('0%')
  })

  it('趋势恒定 12 格，没有单据的月份为 0 发生量', async () => {
    const harness = buildHarness({ orders: [order()] })
    const view = await harness.overview.overview(ASOF)
    expect(view.trend).toHaveLength(12)
    expect(view.trend[view.trend.length - 1]!.label).toBe('2026-07')
  })

  it('准交率没有可判定的行时留空', async () => {
    const harness = buildHarness({ orders: [order()] })
    const view = await harness.overview.overview(ASOF)
    expect(view.headline.onTimeRate).toBe('')
  })
})
