import { ASOF, buildHarness, order, salesReturn, shipment } from './harness'

import type { InvoiceRecord } from '../../invoice-request'

function invoice(shipmentId: string | null): InvoiceRecord {
  return {
    id: 'INV1',
    docNo: 'INV-1',
    kind: 'INVOICE',
    originalId: null,
    customerId: 'C1',
    invoiceKind: 'SPECIAL',
    statementId: null,
    currency: 'CNY',
    amountExTaxMinor: 100n,
    taxAmountMinor: 13n,
    amountIncTaxMinor: 113n,
    title: 'x',
    taxNo: 'x',
    bankAccount: null,
    address: null,
    deliveryMethod: 'EMAIL',
    deliveryTarget: 'a@b.c',
    amountMatched: true,
    matchNote: null,
    expectedPaymentDate: null,
    status: 'COMPLETED',
    ownerUserCode: 'WFX-2018-0042',
    submittedAt: null,
    invoiceNo: null,
    issuedAt: null,
    sentAt: null,
    signedAt: null,
    reasonText: null,
    versionLock: 0,
    lines: [
      {
        id: 'IL1',
        sequence: 1,
        shipmentId,
        shipmentNo: 'SHP-1',
        productName: 'x',
        drawingNo: 'y',
        quantity: '1.000000',
        unitPriceMinor: 100n,
        amountMinor: 100n,
        taxRateBps: 1300,
        taxAmountMinor: 13n,
      },
    ],
  } as InvoiceRecord
}

/**
 * 排序与多组场景。
 *
 * 分开测的理由：单组数据永远走不到比较函数的另一半，
 * 而排序错了不会抛异常——它只是让报表上的名次悄悄错位。
 */
describe('多组数据下的排序', () => {
  it('订单趋势跨月排序，且第二个月能算出环比', async () => {
    const june = order({ id: 'O1', approvedAt: new Date(2026, 5, 10) })
    const july = order({
      id: 'O2',
      approvedAt: new Date(2026, 6, 10),
      lines: [{ ...order().lines[0]!, quantity: '200.000000' }],
    })
    const harness = buildHarness({ orders: [july, june] })
    const rows = await harness.orders.orderTrend()

    expect(rows.map((row) => row.month)).toEqual(['2026-06', '2026-07'])
    expect(rows[1]!.mom).toBeGreaterThan(0)
  })

  it('同比：去年同月有数据时算得出来', async () => {
    const lastYear = order({ id: 'O0', approvedAt: new Date(2025, 6, 10) })
    const thisYear = order({
      id: 'O1',
      approvedAt: new Date(2026, 6, 10),
      lines: [{ ...order().lines[0]!, quantity: '200.000000' }],
    })
    const harness = buildHarness({ orders: [lastYear, thisYear] })
    const rows = await harness.orders.orderTrend()

    // 金额在万元这一级保留一位小数，0.2 → 0.5 的增幅因此是 1.5 而不是 1
    expect(rows.find((row) => row.month === '2026-07')!.yoy).toBe(1.5)
  })

  it('backlog 按月跨月排序', async () => {
    const august = order({
      id: 'O2',
      lines: [{ ...order().lines[0]!, deliveryDate: new Date(2026, 7, 5) }],
    })
    const harness = buildHarness({ orders: [august, order()] })
    const rows = await harness.orders.backlogByMonth()

    expect(rows.map((row) => row.month)).toEqual(['2026-07', '2026-08'])
  })

  it('样品转化按月跨月排序', async () => {
    const june = order({ id: 'S1', orderType: 'SAMPLE', approvedAt: new Date(2026, 5, 10) })
    const july = order({ id: 'S2', orderType: 'SAMPLE', approvedAt: new Date(2026, 6, 10) })
    const harness = buildHarness({ orders: [july, june] })

    expect((await harness.quotes.sampleCycle()).map((row) => row.month)).toEqual([
      '2026-06',
      '2026-07',
    ])
  })

  it('准交表按客户名排序', async () => {
    const other = order({ id: 'O2', customerId: 'A1', lines: [{ ...order().lines[0]!, id: 'OL2' }] })
    const otherShip = shipment({ id: 'SH2', customerId: 'A1', lines: [{ ...shipment().lines[0]!, orderLineId: 'OL2' }] })
    const harness = buildHarness({ orders: [order(), other], shipments: [shipment(), otherShip] })

    expect((await harness.delivery.onTimeByCustomer()).map((row) => row.customer)).toEqual(['A1', 'C1'])
  })

  it('客户排行按金额降序，累计占比递增', async () => {
    const big = order({
      id: 'O2',
      customerId: 'C2',
      lines: [{ ...order().lines[0]!, quantity: '500.000000' }],
    })
    const harness = buildHarness({ orders: [order(), big] })
    const rows = await harness.customers.ranking()

    expect(rows[0]!.customer).toBe('C2')
    expect(rows[1]!.cumShare).toBeGreaterThan(rows[0]!.cumShare)
  })

  it('流失预警按闲置天数降序', async () => {
    const older = order({ id: 'O2', customerId: 'C2', approvedAt: new Date(2025, 11, 1) })
    const newer = order({ id: 'O1', customerId: 'C1', approvedAt: new Date(2026, 3, 1) })
    const harness = buildHarness({ orders: [newer, older] })
    const rows = await harness.customers.churn(ASOF)

    expect(rows.map((row) => row.customer)).toEqual(['C2', 'C1'])
  })

  it('新客户按首单日倒序', async () => {
    const early = order({ id: 'O2', customerId: 'C2', approvedAt: new Date(2026, 1, 1) })
    const harness = buildHarness({ orders: [early, order()] })

    expect((await harness.customers.newCustomers(new Date(2026, 0, 1))).map((row) => row.customer)).toEqual([
      'C1',
      'C2',
    ])
  })

  it('部分出货按剩余量降序', async () => {
    const twoLines = order({
      lines: [
        { ...order().lines[0]!, id: 'OL1', quantity: '100.000000' },
        { ...order().lines[0]!, id: 'OL2', quantity: '500.000000' },
      ],
    })
    const partial = shipment({
      lines: [
        { ...shipment().lines[0]!, id: 'SL1', orderLineId: 'OL1', shippedQty: '90.000000' },
        { ...shipment().lines[0]!, id: 'SL2', orderLineId: 'OL2', shippedQty: '100.000000' },
      ],
    })
    const harness = buildHarness({ orders: [twoLines], shipments: [partial] })

    expect((await harness.delivery.partialShipments()).map((row) => row.remainQty)).toEqual([400, 10])
  })

  it('重复问题按次数降序', async () => {
    const twice = salesReturn({ id: 'R1' })
    const again = salesReturn({ id: 'R2', docNo: 'RMA-2' })
    const third = salesReturn({
      id: 'R3',
      docNo: 'RMA-3',
      customerId: 'C2',
      lines: [{ ...salesReturn().lines[0]!, productName: '压板' }],
    })
    const fourth = salesReturn({
      id: 'R4',
      docNo: 'RMA-4',
      customerId: 'C2',
      lines: [{ ...salesReturn().lines[0]!, productName: '压板' }],
    })
    const fifth = salesReturn({
      id: 'R5',
      docNo: 'RMA-5',
      customerId: 'C2',
      complaintAt: new Date(2026, 6, 28),
      lines: [{ ...salesReturn().lines[0]!, productName: '压板' }],
    })
    const harness = buildHarness({ returns: [twice, again, third, fourth, fifth] })
    const rows = await harness.rma.repeatIssues()

    expect(rows[0]!.times).toBe(3)
    expect(rows[0]!.lastAt).toBe('2026-07-28')
  })

  it('三段勾稽按账龄降序，已开票的行标出来', async () => {
    const older = shipment({ id: 'SH2', docNo: 'SHP-2', shippedAt: new Date(2026, 6, 1) })
    const harness = buildHarness({
      shipments: [shipment(), older],
      invoices: [invoice('SH1')],
    })
    const rows = await harness.customers.invoiceReceivable(ASOF)

    expect(rows[0]!.docNo).toBe('SHP-2')
    expect(rows.find((row) => row.docNo === 'SHP-20260727-0064')!.invoiced).toBe(true)
  })

  it('发票行没有关联出货时不影响勾稽判定', async () => {
    const harness = buildHarness({ shipments: [shipment()], invoices: [invoice(null)] })
    expect((await harness.customers.invoiceReceivable(ASOF))[0]!.invoiced).toBe(false)
  })

  /**
   * ⚠️ `backlogAlerts` 内部取 `new Date()`，因此测试必须相对**当下**造数据。
   * 写死日期的那种测试会在某个未来的日子毫无征兆地变红。
   */
  it('临期预警按剩余天数升序——超期的排在临期之前', async () => {
    const now = Date.now()
    const soon = order({
      id: 'O2',
      docNo: 'SO-SOON',
      lines: [{ ...order().lines[0]!, deliveryDate: new Date(now + 3 * 86_400_000) }],
    })
    const overdue = order({
      id: 'O3',
      docNo: 'SO-LATE',
      lines: [{ ...order().lines[0]!, deliveryDate: new Date(now - 10 * 86_400_000) }],
    })
    const harness = buildHarness({ orders: [soon, overdue] })
    const rows = await harness.orders.backlogAlerts(7)

    expect(rows.map((row) => row.orderNo)).toEqual(['SO-LATE', 'SO-SOON'])
    expect(rows[0]!.level).toBe('late')
    expect(rows[1]!.level).toBe('due')
  })

  it('出货数量汇总跨多行', async () => {
    const multi = shipment({
      lines: [
        { ...shipment().lines[0]!, id: 'SL1', shippedQty: '10.000000' },
        { ...shipment().lines[0]!, id: 'SL2', shippedQty: '15.000000' },
      ],
    })
    const harness = buildHarness({ shipments: [multi] })
    const report = await harness.dailyOps.report(ASOF)

    expect(report.rows.find((row) => row.date === '2026-07-20')!.shippedQty).toBe(25)
  })

  it('审批效率在没有节点记录时为空数组', async () => {
    const harness = buildHarness({ orders: [order()] })
    expect(await harness.sla.approvalEfficiency()).toEqual([])
  })
})
