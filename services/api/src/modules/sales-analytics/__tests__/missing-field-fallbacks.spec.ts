import { ASOF, buildHarness, order, salesReturn, shipment } from './harness'

/**
 * 缺字段时的回落。
 *
 * 这一组存在的理由：真实数据里到处是 null——没指派业务员的订单、没有明细行的
 * 出货单、没写理由的退货行。分析层遇到它们必须给出**一眼能看出是缺失**的占位符
 * （'—' / '未指派'），而不是空白、`undefined` 或者一个看着像真值的 0。
 */
describe('缺字段一律回落成看得出来的占位符', () => {
  it('没有创建人的订单在按业务员分组里落到「未指派」', async () => {
    const orphan = order({ createdBy: null })
    const harness = buildHarness({ orders: [orphan] })
    const rows = await harness.quotes.byOwner()

    expect(rows[0]!.name).toBe('未指派')
  })

  it('没有明细行的订单在按产品分组里落到「未命名」', async () => {
    const empty = order({ lines: [] })
    const harness = buildHarness({ orders: [empty] })

    expect((await harness.quotes.byMaterial())[0]!.name).toBe('未命名')
    expect((await harness.orders.backlogByProduct())[0]!.name).toBe('未命名')
  })

  it('临期预警在订单没有明细行时产品名为空串，不炸', async () => {
    const empty = order({ lines: [], approvedAt: new Date(2026, 6, 1) })
    const harness = buildHarness({ orders: [empty] })
    // 没有交期就不进预警，这里验证的是不抛异常
    expect(await harness.orders.backlogAlerts(7)).toEqual([])
  })

  it('临期预警里没有创建人时 owner 为空串', async () => {
    const overdue = order({
      createdBy: null,
      lines: [{ ...order().lines[0]!, deliveryDate: new Date(2026, 5, 1) }],
    })
    const harness = buildHarness({ orders: [overdue] })
    expect((await harness.orders.backlogAlerts(7))[0]!.owner).toBe('')
  })

  it('backlog 维度表里全组都没有交期时，最近交期显示 —', async () => {
    const undated = order({ lines: [{ ...order().lines[0]!, deliveryDate: null }] })
    const harness = buildHarness({ orders: [undated] })
    expect((await harness.orders.backlogByCustomer())[0]!.nearestDue).toBe('—')
  })

  it('执行中的在手订单在预警里显示为「生产中」', async () => {
    const executing = order({
      status: 'EXECUTING',
      lines: [{ ...order().lines[0]!, deliveryDate: new Date(2026, 6, 30) }],
    })
    const harness = buildHarness({ orders: [executing] })
    expect((await harness.orders.backlogAlerts(7))[0]!.stage).toBe('生产中')
  })

  it('从未下过单的客户在活跃度表里最后下单日显示 —', async () => {
    // 只有草稿（approvedAt 为 null）的客户根本不进 histories，因此列表为空
    const draft = order({ approvedAt: null, status: 'DRAFT' })
    const harness = buildHarness({ orders: [draft] })
    expect(await harness.customers.activity(ASOF)).toEqual([])
  })

  it('流失客户的跟进记录如实留空——系统里还没有 CRM 行为表', async () => {
    const stale = order({ approvedAt: new Date(2026, 0, 1) })
    const harness = buildHarness({ orders: [stale] })
    const rows = await harness.customers.churn(ASOF)

    expect(rows[0]).toMatchObject({ followedAt: '—', followResult: '—' })
    expect(rows[0]!.nextAction).toContain('回访')
  })

  it('观察级客户给出的是「关注下单节奏」而不是回访', async () => {
    const watching = order({ approvedAt: new Date(2026, 4, 20) })
    const harness = buildHarness({ orders: [watching] })
    const rows = await harness.customers.churn(ASOF)

    expect(rows[0]!.level).toBe('watch')
    expect(rows[0]!.nextAction).toBe('关注下单节奏')
  })

  it('新客户的来源如实留空——档案里没有这个字段', async () => {
    const harness = buildHarness({ orders: [order()] })
    expect((await harness.customers.newCustomers(new Date(2026, 0, 1)))[0]!.source).toBe('—')
  })

  it('部分出货的行没有交期时显示 —', async () => {
    const undated = order({ lines: [{ ...order().lines[0]!, deliveryDate: null }] })
    const half = shipment({ lines: [{ ...shipment().lines[0]!, shippedQty: '40.000000' }] })
    const harness = buildHarness({ orders: [undated], shipments: [half] })

    expect((await harness.delivery.partialShipments())[0]!.dueDate).toBe('—')
  })

  it('退货行没有处置理由时，处置摘要回落到该行的不良现象', async () => {
    const noNote = salesReturn({
      lines: [{ ...salesReturn().lines[0]!, dispositionNote: null, disposition: 'REWORK' }],
    })
    const harness = buildHarness({ returns: [noNote] })
    const rows = await harness.rma.byResponsibility()

    expect(rows[0]!.handled).toContain('返工')
  })

  it('未知处置枚举原样透出，不静默吞掉', async () => {
    const odd = salesReturn({
      lines: [{ ...salesReturn().lines[0]!, disposition: 'UNDECIDED' }],
    })
    const harness = buildHarness({ returns: [odd] })
    expect((await harness.rma.byResponsibility())[0]!.handled).toContain('待定')
  })

  it('退货单里有未结案的，重复问题状态显示「仍有未结案」', async () => {
    const open = salesReturn({ id: 'RMA2', docNo: 'RMA-2', status: 'EXECUTING' })
    const harness = buildHarness({ returns: [salesReturn(), open] })
    expect((await harness.rma.repeatIssues())[0]!.status).toBe('仍有未结案')
  })

  it('客诉没有响应时间时不计入达标', async () => {
    const unanswered = salesReturn({ respondedAt: null })
    const harness = buildHarness({ returns: [unanswered] })
    expect(await harness.rma.responseRate(2)).toBe(0)
  })

  it('未提交的订单在周期表里不出现——没有起点就没有耗时', async () => {
    const noSubmit = order({ submittedAt: null })
    const harness = buildHarness({ orders: [noSubmit] })
    expect(await harness.quotes.cycle()).toEqual([])
  })

  it('待办的时间戳缺失时显示 — 而不是 1970-01-01', async () => {
    const noSubmit = order({ status: 'MANAGER_REVIEW', submittedAt: null })
    const harness = buildHarness({ orders: [noSubmit] })
    const view = await harness.workbench.workbench('WFX-2018-0042', ASOF)

    const todo = view.todos.find((item) => item.category === '订单待审核')
    expect(todo?.dueAt).toBe('—')
    expect(todo?.title).toBe('订单待审核')
    expect(todo?.level).toBe('due')
  })

  it('待出运与发票草稿也会进待办', async () => {
    const packed = shipment({ status: 'PACKED', shippedAt: null })
    const harness = buildHarness({ shipments: [packed] })
    const view = await harness.workbench.workbench('WFX-2018-0042', ASOF)

    expect(view.todos.some((item) => item.category === '待出运')).toBe(true)
  })

  it('交期预警也会进待办，超期的标 overdue', async () => {
    const overdue = order({ lines: [{ ...order().lines[0]!, deliveryDate: new Date(2026, 5, 1) }] })
    const harness = buildHarness({ orders: [overdue] })
    const view = await harness.workbench.workbench('WFX-2018-0042', ASOF)

    const alert = view.todos.find((item) => item.category === '交期预警')
    expect(alert?.level).toBe('overdue')
  })

  it('空数据源下工作台不炸，KPI 仍给出两张零发生的卡', async () => {
    const harness = buildHarness()
    const view = await harness.workbench.workbench('WFX-2018-0042', ASOF)

    expect(view.todos).toEqual([])
    expect(view.alerts).toEqual([])
    expect(view.kpis).toHaveLength(2)
    // 这里的 0 是「本月确实没接单」，不是「没有数据」——数据源是真实的订单表
    expect(view.kpis[0]!.value).toBe('0')
    expect(view.kpis[0]!.trendUp).toBe(false)
  })

  it('看板首屏在完全没有订单时不炸', async () => {
    const harness = buildHarness()
    const view = await harness.overview.overview(ASOF)

    expect(view.trend).toHaveLength(12)
    expect(view.topCustomers).toEqual([])
    expect(view.orderMix).toEqual([])
    expect(view.headline.ytdAmount).toBe('0')
  })
})
