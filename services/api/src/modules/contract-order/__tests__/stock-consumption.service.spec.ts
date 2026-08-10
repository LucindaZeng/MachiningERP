import { CROSS, FINANCE, GM, MANAGER, READY_CONTEXT, SALES, buildHarness, draft } from './harness'

import type { Harness } from './harness'

/** 建一张已完工入库、可被领用的备料订单 */
async function stockedPrep(harness: Harness, unitCostMinor: bigint, qty = '20'): Promise<string> {
  const created = await harness.orders.create(
    draft('STOCK_PREP', {
      lines: [
        {
          ...draft('STOCK_PREP').lines[0]!,
          quantity: qty,
        },
      ],
    }),
    READY_CONTEXT,
    SALES,
  )

  const a = await harness.review.submit(created.id, created.versionLock, READY_CONTEXT, SALES)
  const b = await harness.review.approve(a.id, a.versionLock, MANAGER)
  const c = await harness.review.approve(b.id, b.versionLock, FINANCE)
  const d = await harness.review.approve(c.id, c.versionLock, GM)
  await harness.review.approve(d.id, d.versionLock, CROSS)

  harness.orderRepo.stockUnitCosts.set(created.id, unitCostMinor)
  await harness.orderRepo.recordStockIn(created.id, qty, 'STOCKED')
  return created.id
}

describe('备料领用（业务规格 4.5 的原例）', () => {
  it('订单100 / 备料20@10元 / 新产80@12元 → 加权 11.6 元并落履历', async () => {
    const harness = buildHarness()
    const stockId = await stockedPrep(harness, 1_000n, '20')

    const record = await harness.stock.consume(
      {
        orderLineId: 'SOL-formal-1',
        stockOrderId: stockId,
        orderQty: '100',
        produceUnitCostMinor: 1_200n,
      },
      SALES,
    )

    expect(record.consumedQty).toBe('20')
    expect(record.produceQty).toBe('80')
    expect(record.blendedUnitCostMinor).toBe(1_160n)
  })

  it('履历可查：备料单被哪张订单行领用过', async () => {
    const harness = buildHarness()
    const stockId = await stockedPrep(harness, 1_000n)
    await harness.stock.consume(
      { orderLineId: 'SOL-A', stockOrderId: stockId, orderQty: '100', produceUnitCostMinor: 1_200n },
      SALES,
    )

    const history = await harness.stock.history(stockId)
    expect(history).toHaveLength(1)
    expect(history[0]?.orderLineId).toBe('SOL-A')
  })
})

describe('优先消耗备料，直到用完', () => {
  it('第二张订单只能领到剩下的量', async () => {
    const harness = buildHarness()
    const stockId = await stockedPrep(harness, 1_000n, '30')

    await harness.stock.consume(
      { orderLineId: 'SOL-A', stockOrderId: stockId, orderQty: '20', produceUnitCostMinor: 1_200n },
      SALES,
    )
    const second = await harness.stock.consume(
      { orderLineId: 'SOL-B', stockOrderId: stockId, orderQty: '50', produceUnitCostMinor: 1_200n },
      SALES,
    )

    // 备料共 30，已被领 20，第二单只能领 10，其余 40 新产
    expect(second.consumedQty).toBe('10')
    expect(second.produceQty).toBe('40')
  })

  it('用完之后再领报 ORD_2020', async () => {
    const harness = buildHarness()
    const stockId = await stockedPrep(harness, 1_000n, '20')
    await harness.stock.consume(
      { orderLineId: 'SOL-A', stockOrderId: stockId, orderQty: '100', produceUnitCostMinor: 1_200n },
      SALES,
    )

    await expect(
      harness.stock.consume(
        { orderLineId: 'SOL-B', stockOrderId: stockId, orderQty: '10', produceUnitCostMinor: 1_200n },
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2020' })
  })

  it('同一订单行不能重复领用同一张备料单', async () => {
    const harness = buildHarness()
    const stockId = await stockedPrep(harness, 1_000n, '100')
    await harness.stock.consume(
      { orderLineId: 'SOL-A', stockOrderId: stockId, orderQty: '10', produceUnitCostMinor: 1_200n },
      SALES,
    )

    await expect(
      harness.stock.consume(
        { orderLineId: 'SOL-A', stockOrderId: stockId, orderQty: '10', produceUnitCostMinor: 1_200n },
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2020' })
  })

  it('解除领用后可以重新领', async () => {
    const harness = buildHarness()
    const stockId = await stockedPrep(harness, 1_000n, '100')
    await harness.stock.consume(
      { orderLineId: 'SOL-A', stockOrderId: stockId, orderQty: '10', produceUnitCostMinor: 1_200n },
      SALES,
    )
    await harness.stock.release('SOL-A', SALES)

    const again = await harness.stock.consume(
      { orderLineId: 'SOL-A', stockOrderId: stockId, orderQty: '10', produceUnitCostMinor: 1_200n },
      SALES,
    )
    expect(again.consumedQty).toBe('10')
  })
})

describe('领用闸门', () => {
  it('还在生产中的备料单不能被领用', async () => {
    const harness = buildHarness()
    const created = await harness.orders.create(draft('STOCK_PREP'), READY_CONTEXT, SALES)
    harness.orderRepo.stockUnitCosts.set(created.id, 1_000n)

    await expect(
      harness.stock.consume(
        {
          orderLineId: 'SOL-A',
          stockOrderId: created.id,
          orderQty: '10',
          produceUnitCostMinor: 1_200n,
        },
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2021' })
  })

  it('备料单不存在报 ORD_2000', async () => {
    const harness = buildHarness()

    await expect(
      harness.stock.consume(
        { orderLineId: 'SOL-A', stockOrderId: 'nope', orderQty: '10', produceUnitCostMinor: 1n },
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2000' })
  })

  it('非业务岗位领不了', async () => {
    const harness = buildHarness()
    const stockId = await stockedPrep(harness, 1_000n)

    await expect(
      harness.stock.consume(
        { orderLineId: 'SOL-A', stockOrderId: stockId, orderQty: '10', produceUnitCostMinor: 1n },
        MANAGER,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2012' })
  })

  it('按图号能查到可领用的备料单', async () => {
    const harness = buildHarness()
    await stockedPrep(harness, 1_000n, '20')

    const available = await harness.stock.listAvailable('BCM-2607')
    expect(available).toHaveLength(1)
    expect(available[0]?.availableQty).toBe('20')
    expect(available[0]?.stockStatus).toBe('STOCKED')
  })

  it('图号对不上就查不到', async () => {
    const harness = buildHarness()
    await stockedPrep(harness, 1_000n)

    expect(await harness.stock.listAvailable('OTHER-001')).toEqual([])
  })
})
