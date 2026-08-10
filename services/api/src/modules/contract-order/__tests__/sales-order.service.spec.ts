import { MANAGER, READY_CONTEXT, SALES, buildHarness, draft } from './harness'

describe('建单', () => {
  it('按订单类型取号：正式 SO / 样品 SMP / 模具 MLD / 备料 STK', async () => {
    const harness = buildHarness()

    const formal = await harness.orders.create(draft('FORMAL'), READY_CONTEXT, SALES)
    const sample = await harness.orders.create(
      draft('SAMPLE', { chargeMode: 'CHARGED' }),
      READY_CONTEXT,
      SALES,
    )
    const mold = await harness.orders.create(draft('MOLD'), READY_CONTEXT, SALES)
    const stock = await harness.orders.create(draft('STOCK_PREP'), READY_CONTEXT, SALES)

    expect(formal.docNo).toMatch(/^SO/)
    expect(sample.docNo).toMatch(/^SMP/)
    expect(mold.docNo).toMatch(/^MLD/)
    expect(stock.docNo).toMatch(/^STK/)
  })

  it('建单即记编制节点，初始为草稿', async () => {
    const harness = buildHarness()
    const created = await harness.orders.create(draft(), READY_CONTEXT, SALES)

    expect(created.status).toBe('DRAFT')
    expect(created.createdBy).toBe(SALES.userCode)
    expect(harness.timelineEnter).toHaveBeenCalledWith(
      expect.objectContaining({ node: '订单编制', ownerDept: '业务部' }),
    )
  })

  it('备料订单建单即进入生产中状态', async () => {
    const harness = buildHarness()
    const created = await harness.orders.create(draft('STOCK_PREP'), READY_CONTEXT, SALES)

    expect(created.stockStatus).toBe('PRODUCING')
  })

  it('非业务岗位建不了单', async () => {
    const harness = buildHarness()

    await expect(
      harness.orders.create(draft(), READY_CONTEXT, MANAGER),
    ).rejects.toMatchObject({ code: 'ORD_2012' })
  })

  it('客户档案没补全就建不了单', async () => {
    const harness = buildHarness()

    await expect(
      harness.orders.create(
        draft(),
        { customerReadyForOrder: false, bomConfirmed: { 1: true } },
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2005' })
  })

  it('缺失项以结构化清单下发，前端能逐条渲染', async () => {
    const harness = buildHarness()

    const error = await harness.orders
      .create(draft('FORMAL', { customerPoNo: null, customerPoFile: null }), READY_CONTEXT, SALES)
      .then(() => null)
      .catch((caught: unknown) => caught as { details: Array<{ field: string }> })

    expect(error?.details.map((issue) => issue.field)).toEqual(['customerPoNo', 'customerPoFile'])
  })

  it('订单不存在报 ORD_2000', async () => {
    const harness = buildHarness()
    await expect(harness.orders.load('nope')).rejects.toMatchObject({ code: 'ORD_2000' })
  })
})

describe('草稿维护', () => {
  it('整单替换后版本号自增', async () => {
    const harness = buildHarness()
    const created = await harness.orders.create(draft(), READY_CONTEXT, SALES)

    const payload = draft()
    payload.lines[0]!.quantity = '200'
    const updated = await harness.orders.updateDraft(
      created.id,
      created.versionLock,
      payload,
      READY_CONTEXT,
      SALES,
    )

    expect(updated.versionLock).toBe(created.versionLock + 1)
    expect(updated.lines[0]?.quantity).toBe('200')
  })

  it('拿旧版本号提交会被乐观锁挡下', async () => {
    const harness = buildHarness()
    const created = await harness.orders.create(draft(), READY_CONTEXT, SALES)
    await harness.orders.updateDraft(created.id, created.versionLock, draft(), READY_CONTEXT, SALES)

    await expect(
      harness.orders.updateDraft(created.id, created.versionLock, draft(), READY_CONTEXT, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2008' })
  })

  it('已送审的单子改不了明细，只能走订单修改申请', async () => {
    const harness = buildHarness()
    const created = await harness.orders.create(draft(), READY_CONTEXT, SALES)
    await harness.review.submit(created.id, created.versionLock, READY_CONTEXT, SALES)

    await expect(
      harness.orders.updateDraft(created.id, 1, draft(), READY_CONTEXT, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2008' })
  })

  it('改草稿同样要跑下单校验', async () => {
    const harness = buildHarness()
    const created = await harness.orders.create(draft(), READY_CONTEXT, SALES)

    await expect(
      harness.orders.updateDraft(
        created.id,
        created.versionLock,
        draft('FORMAL', { customerPoNo: null }),
        READY_CONTEXT,
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2005' })
  })

  it('非业务岗位改不了草稿', async () => {
    const harness = buildHarness()
    const created = await harness.orders.create(draft(), READY_CONTEXT, SALES)

    await expect(
      harness.orders.updateDraft(created.id, 0, draft(), READY_CONTEXT, MANAGER),
    ).rejects.toMatchObject({ code: 'ORD_2012' })
  })
})

describe('列表过滤', () => {
  it('按客户、类型、状态分别过滤', async () => {
    const harness = buildHarness()
    await harness.orders.create(draft('FORMAL'), READY_CONTEXT, SALES)
    await harness.orders.create(draft('STOCK_PREP'), READY_CONTEXT, SALES)

    expect(await harness.orders.list({ limit: 50 })).toHaveLength(2)
    expect(await harness.orders.list({ orderType: 'STOCK_PREP', limit: 50 })).toHaveLength(1)
    expect(await harness.orders.list({ customerId: 'CU1', limit: 50 })).toHaveLength(2)
    expect(await harness.orders.list({ customerId: 'CU9', limit: 50 })).toHaveLength(0)
    expect(await harness.orders.list({ status: 'APPROVED', limit: 50 })).toHaveLength(0)
  })

  it('limit 生效', async () => {
    const harness = buildHarness()
    await harness.orders.create(draft(), READY_CONTEXT, SALES)
    await harness.orders.create(draft(), READY_CONTEXT, SALES)

    expect(await harness.orders.list({ limit: 1 })).toHaveLength(1)
  })
})
