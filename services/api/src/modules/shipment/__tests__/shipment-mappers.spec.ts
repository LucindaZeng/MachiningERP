import { keepLatestVersions } from '../repositories/prisma-statement.repository'
import { toShipmentTimelineView } from '../services/shipment-timeline.mapper'
import { lineAmountMinor, toShipmentView } from '../services/shipment-view.mapper'
import { STATEMENT_LINE_TYPE_LABEL, toStatementView } from '../services/statement-view.mapper'

import type { TimelineNodeRecord } from '../../../platform/timeline'
import type { ShipmentLineRecord, ShipmentRecord } from '../repositories/shipment.repository.port'
import type { StatementRecord } from '../repositories/statement.repository.port'

const NAMING = {
  orderNo: 'SO-20260710-0085',
  customerName: 'Radex Instruments Inc.',
  ownerName: '陈志强',
}

function line(overrides: Partial<ShipmentLineRecord> = {}): ShipmentLineRecord {
  return {
    id: 'L1',
    sequence: 1,
    orderLineId: 'OL1',
    productName: '探头支架',
    drawingNo: 'RX-3390',
    itemCode: 'P-RX3390-D-02',
    batchNo: 'B26071502',
    orderedQty: '1500.000000',
    qualifiedQty: '1486.000000',
    packedQty: '1486.000000',
    shippedQty: '1486.000000',
    unitPriceMinor: 2_490n,
    tailPlan: null,
    tailResolvedQty: '0.000000',
    tailApprovedBy: null,
    tailApprovedAt: null,
    tailRemark: null,
    ...overrides,
  }
}

function shipment(overrides: Partial<ShipmentRecord> = {}): ShipmentRecord {
  return {
    id: 'S1',
    docNo: 'SHP-20260727-0064',
    orderId: 'O1',
    customerId: 'C1',
    deliveryAddressId: null,
    replacesReturnId: null,
    currency: 'CNY',
    carrier: null,
    trackingNo: null,
    invoiceNo: null,
    status: 'PACKED',
    ownerUserCode: 'WFX-2018-0042',
    packedAt: new Date('2026-07-27T07:20:00Z'),
    shippedAt: null,
    signedAt: null,
    invoicedAt: null,
    closedAt: null,
    versionLock: 0,
    lines: [line()],
    ...overrides,
  }
}

describe('行金额 = 本次发货数 × 单价', () => {
  it('1486 × 24.90 = 37001.40', () => {
    expect(lineAmountMinor(line())).toBe(3_700_140n)
  })

  it('小数数量不产生浮点漂移', () => {
    expect(lineAmountMinor(line({ shippedQty: '0.100000', unitPriceMinor: 333n }))).toBe(33n)
  })
})

describe('出货单视图对齐前端形状', () => {
  it('单产品出货时表头产品名就是行名', () => {
    const view = toShipmentView(shipment(), NAMING, [])
    expect(view.productName).toBe('探头支架')
  })

  it('多产品时表头写「首行 等 N 项」', () => {
    const view = toShipmentView(
      shipment({ lines: [line(), line({ id: 'L2', sequence: 2, productName: '安装座' })] }),
      NAMING,
      [],
    )
    expect(view.productName).toBe('探头支架 等 2 项')
  })

  it('没有明细时不炸', () => {
    const view = toShipmentView(shipment({ lines: [] }), NAMING, [])
    expect(view.productName).toBe('')
    expect(view.batchNo).toBe('')
    expect(view.amount.amount).toBe('0.00')
  })

  it('「已发」在出运前是 0——行上的数量是本单计划发多少', () => {
    expect(toShipmentView(shipment(), NAMING, []).shippedQty).toBe('0.000000')
  })

  it('出运之后才把已发数亮出来', () => {
    const view = toShipmentView(shipment({ status: 'SHIPPED' }), NAMING, [])
    expect(view.shippedQty).toBe('1486.000000')
  })

  it('表头数量是各行合计', () => {
    const view = toShipmentView(
      shipment({
        lines: [line(), line({ id: 'L2', sequence: 2, orderedQty: '500.000000', shippedQty: '500.000000' })],
      }),
      NAMING,
      [],
    )

    expect(view.orderedQty).toBe('2000.000000')
    expect(view.tailQty).toBe('14.000000')
  })

  it('七个状态都翻成前端的小写值', () => {
    const statuses = ['PLANNED', 'PICKING', 'PACKED', 'SHIPPED', 'SIGNED', 'INVOICED', 'CLOSED'] as const
    const wire = statuses.map((status) => toShipmentView(shipment({ status }), NAMING, []).status)

    expect(wire).toEqual(['planned', 'picking', 'packed', 'shipped', 'signed', 'invoiced', 'closed'])
  })

  it('可选字段没值时不出现在返回体里', () => {
    const view = toShipmentView(shipment(), NAMING, [])

    expect(view).not.toHaveProperty('carrier')
    expect(view).not.toHaveProperty('invoiceNo')
    expect(view).not.toHaveProperty('tailPlan')
  })

  it('有值时逐个带出', () => {
    const view = toShipmentView(
      shipment({
        status: 'INVOICED',
        carrier: 'DHL',
        trackingNo: 'DHL-1',
        invoiceNo: 'INV-26-0771',
        shippedAt: new Date('2026-07-28T01:30:00Z'),
        signedAt: new Date('2026-08-01T06:00:00Z'),
      }),
      NAMING,
      [],
    )

    expect(view.carrier).toBe('DHL')
    expect(view.invoiceNo).toBe('INV-26-0771')
    expect(view.signedAt).toBeDefined()
  })
})

describe('表头尾数方案：口径一致才透出', () => {
  it('所有有尾数的行方案一致时透出该方案', () => {
    const view = toShipmentView(
      shipment({ lines: [line({ tailPlan: 'REWORK' })] }),
      NAMING,
      [],
    )
    expect(view.tailPlan).toBe('rework')
  })

  it('有尾数但还没定方案时不透出', () => {
    expect(toShipmentView(shipment(), NAMING, []).tailPlan).toBeUndefined()
  })

  it('两行方案不一致时留空，不给一个会误导人的「多数派」标签', () => {
    const view = toShipmentView(
      shipment({
        lines: [
          line({ tailPlan: 'REWORK' }),
          line({ id: 'L2', sequence: 2, tailPlan: 'SCRAP' }),
        ],
      }),
      NAMING,
      [],
    )
    expect(view.tailPlan).toBeUndefined()
  })

  it('没有任何尾数时不透出方案', () => {
    const view = toShipmentView(
      shipment({ lines: [line({ shippedQty: '1500.000000', tailPlan: 'STOCK' })] }),
      NAMING,
      [],
    )
    expect(view.tailPlan).toBeUndefined()
  })
})

describe('节点计时视图补齐 SHP-01~06 六格', () => {
  function node(overrides: Partial<TimelineNodeRecord>): TimelineNodeRecord {
    return {
      id: 'T1',
      docType: 'SHP',
      docId: 'S1',
      node: 'SHP-01 生成发货通知',
      sequence: 1,
      status: 'DONE',
      enteredAt: new Date('2026-07-27T00:00:00Z'),
      leftAt: new Date('2026-07-27T00:48:00Z'),
      durationMs: 2_880_000n,
      ownerUserCode: 'WFX-2018-0042',
      ownerDept: '业务部',
      remark: null,
      ...overrides,
    }
  }

  it('没有任何记录时六格全是 pending', () => {
    const view = toShipmentTimelineView([], '陈志强')

    expect(view).toHaveLength(6)
    expect(view.every((item) => item.state === 'pending')).toBe(true)
  })

  it('耗时取平台算好的 durationMs，换算成小时保留两位', () => {
    const view = toShipmentTimelineView([node({})], '陈志强')

    expect(view[0]?.state).toBe('done')
    expect(view[0]?.elapsedHours).toBe(0.8)
  })

  it('未结束的节点是 active', () => {
    const view = toShipmentTimelineView([node({ leftAt: null, durationMs: null })], '陈志强')

    expect(view[0]?.state).toBe('active')
    expect(view[0]).not.toHaveProperty('elapsedHours')
  })

  it('异常收尾的节点显示为 overdue，并带出备注', () => {
    const view = toShipmentTimelineView(
      [node({ status: 'ABNORMAL', remark: '客户未回签收单' })],
      '陈志强',
    )

    expect(view[0]?.state).toBe('overdue')
    expect(view[0]?.remark).toBe('客户未回签收单')
  })

  it('责任人优先取部门，没有部门时退回工号，再没有才用兜底姓名', () => {
    const view = toShipmentTimelineView(
      [
        node({ ownerDept: null }),
        node({ id: 'T2', node: 'SHP-02 仓库拣配出库', ownerDept: null, ownerUserCode: null }),
      ],
      '陈志强',
    )

    expect(view[0]?.owner).toBe('WFX-2018-0042')
    expect(view[1]?.owner).toBe('陈志强')
  })
})

describe('对账单视图', () => {
  function statement(overrides: Partial<StatementRecord> = {}): StatementRecord {
    return {
      id: 'STM1',
      docNo: 'STM-20260731-0012',
      customerId: 'C1',
      periodFrom: new Date('2026-07-01T00:00:00Z'),
      periodTo: new Date('2026-07-31T00:00:00Z'),
      currency: 'CNY',
      version: 1,
      openingBalanceMinor: 48_620_000n,
      shippedAmountMinor: 12_840_000n,
      invoicedAmountMinor: 12_840_000n,
      receivedAmountMinor: 3_000_000n,
      returnAmountMinor: 477_600n,
      closingBalanceMinor: 57_982_400n,
      differenceAmountMinor: 477_600n,
      differenceNote: '客户主张先冲减',
      overdueAmountMinor: 12_680_000n,
      status: 'DISPUTED',
      ownerUserCode: 'WFX-2018-0042',
      sentAt: new Date('2026-08-01T01:20:00Z'),
      confirmedAt: null,
      versionLock: 0,
      lines: [
        {
          id: 'STML1',
          sequence: 1,
          occurredAt: new Date('2026-07-06T00:00:00Z'),
          type: 'SHIPMENT',
          docNo: 'SHP-20260706-0046',
          productName: '导轨压板',
          quantity: '800.000000',
          amountMinor: 3_184_000n,
          matched: true,
          remark: null,
        },
        {
          id: 'STML2',
          sequence: 2,
          occurredAt: new Date('2026-07-20T00:00:00Z'),
          type: 'RECEIPT',
          docNo: 'RCP-26-0311',
          productName: null,
          quantity: null,
          amountMinor: -3_000_000n,
          matched: true,
          remark: '部分回款',
        },
      ],
      ...overrides,
    }
  }

  const naming = { customerCode: 'C-CN-004', customerName: '苏州明泰自动化', ownerName: '罗晓琳' }

  it('金额一律定点字符串，期间是纯日期', () => {
    const view = toStatementView(statement(), naming)

    expect(view.openingBalance).toBe('486200.00')
    expect(view.closingBalance).toBe('579824.00')
    expect(view.periodFrom).toBe('2026-07-01')
  })

  it('单据类型翻成中文，回款保持负号', () => {
    const view = toStatementView(statement(), naming)

    expect(view.lines[0]?.type).toBe('发货')
    expect(view.lines[1]?.type).toBe('回款')
    expect(view.lines[1]?.amount).toBe('-30000.00')
  })

  it('五种单据类型都有中文文案', () => {
    expect(Object.values(STATEMENT_LINE_TYPE_LABEL)).toEqual(['发货', '开票', '回款', '退货', '折让'])
  })

  it('空值字段不出现在返回体里', () => {
    const view = toStatementView(
      statement({ differenceNote: null, sentAt: null, status: 'DRAFT' }),
      naming,
    )

    expect(view).not.toHaveProperty('differenceNote')
    expect(view).not.toHaveProperty('sentAt')
    expect(view.lines[1]).not.toHaveProperty('productName')
  })

  it('已确认时带出 confirmedAt', () => {
    const view = toStatementView(
      statement({ status: 'CONFIRMED', confirmedAt: new Date('2026-08-04T08:30:00Z') }),
      naming,
    )

    expect(view.confirmedAt).toBe('2026-08-04T08:30:00.000Z')
  })

  it('五个状态都翻成前端小写值', () => {
    const statuses = ['DRAFT', 'SENT', 'CONFIRMED', 'DISPUTED', 'SETTLED'] as const
    const wire = statuses.map((status) => toStatementView(statement({ status }), naming).status)

    expect(wire).toEqual(['draft', 'sent', 'confirmed', 'disputed', 'settled'])
  })

  it('keepLatestVersions 每个客户+期间只留最大版本', () => {
    const kept = keepLatestVersions([
      statement({ id: 'A', version: 3 }),
      statement({ id: 'B', version: 1 }),
      statement({ id: 'C', customerId: 'C2', version: 1 }),
    ])

    expect(kept.map((row) => row.id)).toEqual(['A', 'C'])
  })
})
