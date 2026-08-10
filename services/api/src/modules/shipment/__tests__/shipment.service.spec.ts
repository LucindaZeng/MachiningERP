import { buildPostedLines } from '../services/shipment-posting.service'
import { assertShippableLines } from '../services/shipment.service'

import { ORDER_LINES, OUTSIDER, SALES, buildHarness, draftHeader, draftLines } from './harness'

import type { Harness } from './harness'
import type { ShipmentRecord } from '../repositories/shipment.repository.port'

async function created(harness: Harness): Promise<ShipmentRecord> {
  return harness.shipments.create(draftHeader(), draftLines(), ORDER_LINES, SALES)
}

describe('建单：明细必须挂在订单行上', () => {
  it('一行都没有时拒绝', () => {
    expect(() => assertShippableLines([], ORDER_LINES, {})).toThrow(
      expect.objectContaining({ code: 'ORD_2503' }),
    )
  })

  it('行上没有订单行 id 时拒绝', () => {
    const lines = draftLines().map((line) => ({ ...line, orderLineId: '' }))
    expect(() => assertShippableLines(lines, ORDER_LINES, {})).toThrow(
      expect.objectContaining({ code: 'ORD_2503' }),
    )
  })

  it('引用了别的订单的行时拒绝，并指出是第几行', () => {
    const lines = [{ ...draftLines()[0]!, orderLineId: 'OL-OTHER' }]

    expect(() => assertShippableLines(lines, ORDER_LINES, {})).toThrow(
      expect.objectContaining({ code: 'ORD_2504' }),
    )
  })
})

describe('建单：本次发货 + 历史已发不得超过订单数', () => {
  it('恰好发满订单数时通过', () => {
    const lines = [{ ...draftLines()[0]!, shippedQty: '1500.000000' }]
    expect(() => assertShippableLines(lines, ORDER_LINES, {})).not.toThrow()
  })

  it('叠加历史已发后超出时拒绝，details 里给出还能发多少', () => {
    const lines = [{ ...draftLines()[0]!, shippedQty: '100.000000' }]

    expect(() => assertShippableLines(lines, ORDER_LINES, { OL1: '1450.000000' })).toThrow(
      expect.objectContaining({
        code: 'ORD_2505',
        details: expect.objectContaining({ remaining: '50.000000' }),
      }),
    )
  })

  it('历史已发正好等于订单数时，再发一件也不行', () => {
    const lines = [{ ...draftLines()[0]!, shippedQty: '1.000000' }]

    expect(() => assertShippableLines(lines, ORDER_LINES, { OL1: '1500.000000' })).toThrow(
      expect.objectContaining({ code: 'ORD_2505' }),
    )
  })
})

describe('建单主流程', () => {
  it('取号、落草稿、开 SHP-01 节点', async () => {
    const harness = buildHarness()
    const record = await created(harness)

    expect(record.docNo).toMatch(/^SHP-/)
    expect(record.status).toBe('PLANNED')
    expect(record.lines).toHaveLength(2)
    expect(harness.timelineEnter).toHaveBeenCalledWith(
      expect.objectContaining({ node: 'SHP-01 生成发货通知' }),
    )
  })

  it('非业务岗位建不了', async () => {
    const harness = buildHarness()

    await expect(
      harness.shipments.create(draftHeader(), draftLines(), ORDER_LINES, OUTSIDER),
    ).rejects.toMatchObject({ code: 'ORD_2502' })
  })

  it('单号查不到时抛 404', async () => {
    const harness = buildHarness()
    await expect(harness.shipments.loadByDocNo('SHP-NOPE')).rejects.toMatchObject({
      code: 'ORD_2500',
    })
  })
})

describe('节点推进与双闸门', () => {
  async function packed(harness: Harness): Promise<ShipmentRecord> {
    const record = await created(harness)
    const picking = await harness.flow.startPicking(record.id, record.versionLock, SALES)
    return harness.flow.pack(picking.id, picking.versionLock, SALES)
  }

  it('拣配 → 包装依次推进，各自开自己的节点', async () => {
    const harness = buildHarness()
    const record = await packed(harness)

    expect(record.status).toBe('PACKED')
    expect(record.packedAt).toBeInstanceOf(Date)
    expect(harness.timelineEnter.mock.calls.map((call) => call[0].node)).toEqual([
      'SHP-01 生成发货通知',
      'SHP-02 仓库拣配出库',
      'SHP-03 全检包装完成（T1）',
    ])
  })

  it('跳过拣配直接包装被状态机挡下', async () => {
    const harness = buildHarness()
    const record = await created(harness)

    await expect(harness.flow.pack(record.id, record.versionLock, SALES)).rejects.toMatchObject({
      code: 'SYS_9012',
    })
  })

  it('版本冲突时报 ORD_2501，而不是悄悄改了别人的版本', async () => {
    const harness = buildHarness()
    const record = await created(harness)

    await expect(
      harness.flow.startPicking(record.id, record.versionLock + 5, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2501' })
  })

  it('现金客户未收款时出运被拦，状态停在 PACKED', async () => {
    const harness = buildHarness()
    harness.setPaymentTerm('CASH_BEFORE_SHIPMENT')
    const record = await packed(harness)

    await expect(
      harness.flow.ship(record.id, record.versionLock, null, null, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2506' })

    const reloaded = await harness.shipments.load(record.id)
    expect(reloaded.status).toBe('PACKED')
  })

  it('品质未放行时出运被拦', async () => {
    const harness = buildHarness()
    harness.qc.block('RX-3390', 'B26071502', '阳极氧化色差待判定')
    const record = await packed(harness)

    await expect(
      harness.flow.ship(record.id, record.versionLock, null, null, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2506' })
  })

  it('双闸门通过后出运，回填承运商并推送应收依据', async () => {
    const harness = buildHarness()
    const record = await packed(harness)
    const shipped = await harness.flow.ship(
      record.id,
      record.versionLock,
      'DHL Global Forwarding',
      'DHL-8871209934',
      SALES,
    )

    expect(shipped.status).toBe('SHIPPED')
    expect(shipped.carrier).toBe('DHL Global Forwarding')
    expect(harness.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'sales.shipment.posted',
        payload: expect.objectContaining({
          // 1486 × 24.90 + 1500 × 7.50 = 37001.40 + 11250.00
          receivableMinor: '4825140',
          allLinesFullyShipped: false,
        }),
      }),
    )
  })

  it('签收后发 shipment.signed', async () => {
    const harness = buildHarness()
    const record = await packed(harness)
    const shipped = await harness.flow.ship(record.id, record.versionLock, null, null, SALES)
    await harness.flow.sign(shipped.id, shipped.versionLock, SALES)

    expect(harness.publish).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'sales.shipment.signed' }),
    )
  })

  it('开票必须带发票号', async () => {
    const harness = buildHarness()
    const record = await packed(harness)
    const shipped = await harness.flow.ship(record.id, record.versionLock, null, null, SALES)
    const signed = await harness.flow.sign(shipped.id, shipped.versionLock, SALES)

    await expect(
      harness.flow.invoice(signed.id, signed.versionLock, '   ', SALES),
    ).rejects.toMatchObject({ code: 'ORD_2501' })

    const invoiced = await harness.flow.invoice(
      signed.id,
      signed.versionLock,
      'INV-26-0771',
      SALES,
    )
    expect(invoiced.invoiceNo).toBe('INV-26-0771')
  })
})

describe('结案前的数量平衡校验', () => {
  async function signed(harness: Harness): Promise<ShipmentRecord> {
    const record = await created(harness)
    const picking = await harness.flow.startPicking(record.id, record.versionLock, SALES)
    const packed = await harness.flow.pack(picking.id, picking.versionLock, SALES)
    const shipped = await harness.flow.ship(packed.id, packed.versionLock, null, null, SALES)
    return harness.flow.sign(shipped.id, shipped.versionLock, SALES)
  }

  it('尾数没处置时结不了案，错误里点名是第几行欠多少', async () => {
    const harness = buildHarness()
    const record = await signed(harness)

    await expect(harness.flow.close(record.id, record.versionLock, SALES)).rejects.toMatchObject({
      code: 'ORD_2509',
      details: {
        imbalances: [{ sequence: 1, productName: '探头支架', outstandingQty: '14.000000' }],
      },
    })
  })

  it('尾数处置完就能结案，并通知业务员', async () => {
    const harness = buildHarness()
    const record = await signed(harness)
    await harness.tail.applyByDocNo(record.docNo, 'scrap', '毛坯磕伤', SALES)

    const reloaded = await harness.shipments.load(record.id)
    const closed = await harness.flow.close(reloaded.id, reloaded.versionLock, SALES)

    expect(closed.status).toBe('CLOSED')
    expect(harness.timelineClose).toHaveBeenCalled()
    expect(harness.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('已结案') }),
    )
  })
})

describe('尾数四路径', () => {
  it('四路径之外的值被拒', async () => {
    const harness = buildHarness()
    const record = await created(harness)

    await expect(
      harness.tail.applyByDocNo(record.docNo, 'burn-it', null, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2507' })
  })

  it('没有尾数的单据不接受方案', async () => {
    const harness = buildHarness()
    const lines = draftLines().map((line) => ({ ...line, shippedQty: line.orderedQty }))
    const record = await harness.shipments.create(draftHeader(), lines, ORDER_LINES, SALES)

    await expect(
      harness.tail.applyByDocNo(record.docNo, 'stock', null, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2508' })
  })

  it('只处置还有尾数的那一行，并记下审批人', async () => {
    const harness = buildHarness()
    const record = await created(harness)
    const result = await harness.tail.applyByDocNo(record.docNo, 'stock', '等下批一起走', SALES)

    expect(result).toMatchObject({ plan: 'stock', resolvedLines: 1, resolvedQty: '14.000000' })

    const reloaded = await harness.shipments.load(record.id)
    expect(reloaded.lines[0]?.tailPlan).toBe('STOCK')
    expect(reloaded.lines[0]?.tailApprovedBy).toBe(SALES.userCode)
    expect(reloaded.lines[1]?.tailPlan).toBeNull()
  })

  it('返工补交额外发事件，交给未来的 rework 模块拆子订单', async () => {
    const harness = buildHarness()
    const record = await created(harness)
    await harness.tail.applyByDocNo(record.docNo, 'rework', null, SALES)

    expect(harness.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'sales.shipment.tail-rework-requested',
        payload: expect.objectContaining({ totalReworkQty: '14.000000' }),
      }),
    )
  })

  it('入库 / 直接入库 / 报废三条路径不惊动 rework', async () => {
    for (const plan of ['stock', 'direct-stock', 'scrap']) {
      const harness = buildHarness()
      const record = await created(harness)
      await harness.tail.applyByDocNo(record.docNo, plan, null, SALES)

      expect(harness.publish).not.toHaveBeenCalled()
    }
  })

  it('非业务岗位处置不了尾数', async () => {
    const harness = buildHarness()
    const record = await created(harness)

    await expect(
      harness.tail.applyByDocNo(record.docNo, 'scrap', null, OUTSIDER),
    ).rejects.toMatchObject({ code: 'ORD_2502' })
  })
})

describe('逐行履约事实供订单回写', () => {
  it('累计已发达到订单数才算发齐', async () => {
    const harness = buildHarness()
    const record = await created(harness)

    const lines = buildPostedLines(record, ORDER_LINES, {
      OL1: '1486.000000',
      OL2: '1500.000000',
    })

    expect(lines.map((line) => line.fullyShipped)).toEqual([false, true])
  })

  it('订单行查不到时按未发齐处理，不把没发完的单标成已完成', async () => {
    const harness = buildHarness()
    const record = await created(harness)

    const lines = buildPostedLines(record, [], {})
    expect(lines.every((line) => !line.fullyShipped)).toBe(true)
  })

  it('仓储层还没有累计数时退回本单数量，不至于算成 0', async () => {
    const harness = buildHarness()
    const record = await created(harness)

    const lines = buildPostedLines(record, ORDER_LINES, {})
    expect(lines[1]?.cumulativeShippedQty).toBe('1500.000000')
    expect(lines[1]?.fullyShipped).toBe(true)
  })
})
