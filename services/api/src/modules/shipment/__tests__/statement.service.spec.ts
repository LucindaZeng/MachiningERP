import { assertDifferenceExplained } from '../services/statement.service'

import { ORDER_LINES, OUTSIDER, SALES, buildHarness, draftHeader, draftLines } from './harness'

import type { Harness } from './harness'
import type { StatementRecord } from '../repositories/statement.repository.port'
import type { GenerateStatementInput } from '../services/statement.service'

/**
 * 期间取一个足够宽的窗口：出货动作用的是真实 `new Date()`，
 * 窗口写死成某个月的话，测试会在换月那天莫名其妙变红。
 */
const PERIOD = {
  periodFrom: new Date('2000-01-01T00:00:00Z'),
  periodTo: new Date('2099-12-31T00:00:00Z'),
}

function input(overrides: Partial<GenerateStatementInput> = {}): GenerateStatementInput {
  return {
    customerId: 'C1',
    ...PERIOD,
    basis: 'SHIPMENT',
    customerClosingMinor: null,
    ...overrides,
  }
}

/** 造一张真正发出去的出货单，好让对账单有发货流水可汇总。 */
async function shipOne(harness: Harness): Promise<void> {
  const record = await harness.shipments.create(draftHeader(), draftLines(), ORDER_LINES, SALES)
  const picking = await harness.flow.startPicking(record.id, record.versionLock, SALES)
  const packed = await harness.flow.pack(picking.id, picking.versionLock, SALES)
  await harness.flow.ship(packed.id, packed.versionLock, null, null, SALES)
}

describe('对账单只从源单汇总', () => {
  it('发货流水进 shippedAmount，且期末 = 期初 + 发货', async () => {
    const harness = buildHarness()
    harness.sources.opening = 1_820_000n
    await shipOne(harness)

    const statement = await harness.statements.generate(input(), SALES)

    expect(statement.shippedAmountMinor).toBe(4_825_140n)
    expect(statement.closingBalanceMinor).toBe(1_820_000n + 4_825_140n)
    expect(statement.lines).toHaveLength(2)
    expect(statement.lines.every((line) => line.type === 'SHIPMENT')).toBe(true)
  })

  it('回款与退货折让按负数入账', async () => {
    const harness = buildHarness()
    harness.receipts.entries = [
      { occurredAt: new Date('2026-07-10T00:00:00Z'), docNo: 'RCP-26-0301', amountMinor: 1_820_000n, remark: null },
    ]
    harness.sources.returns = [
      {
        occurredAt: new Date('2026-07-28T00:00:00Z'),
        docNo: 'RMA-20260728-0010',
        productName: '探头支架',
        quantity: '18.000000',
        amountMinor: 44_820n,
        remark: '责任待判定',
      },
    ]

    const statement = await harness.statements.generate(input(), SALES)

    expect(statement.receivedAmountMinor).toBe(1_820_000n)
    expect(statement.returnAmountMinor).toBe(44_820n)
    expect(statement.closingBalanceMinor).toBe(-1_864_820n)
    expect(statement.lines.map((line) => line.amountMinor)).toEqual([-1_820_000n, -44_820n])
  })

  it('明细按日期排序并从 1 开始编号，重算的行号因此稳定', async () => {
    const harness = buildHarness()
    harness.receipts.entries = [
      { occurredAt: new Date('2026-07-20T00:00:00Z'), docNo: 'RCP-2', amountMinor: 1n, remark: null },
    ]
    harness.sources.invoices = [
      {
        occurredAt: new Date('2026-07-06T00:00:00Z'),
        docNo: 'INV-1',
        productName: null,
        quantity: null,
        amountMinor: 2n,
        remark: null,
      },
    ]

    const statement = await harness.statements.generate(input(), SALES)

    expect(statement.lines.map((line) => [line.sequence, line.docNo])).toEqual([
      [1, 'INV-1'],
      [2, 'RCP-2'],
    ])
  })

  it('期间颠倒时拒绝', async () => {
    const harness = buildHarness()

    await expect(
      harness.statements.generate(
        input({ periodFrom: PERIOD.periodTo, periodTo: PERIOD.periodFrom }),
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2603' })
  })

  it('非业务岗位生成不了', async () => {
    const harness = buildHarness()
    await expect(harness.statements.generate(input(), OUTSIDER)).rejects.toMatchObject({
      code: 'ORD_2606',
    })
  })
})

describe('重算产出新版本，已发出的那版一个字不动', () => {
  it('第二次生成时版本号递增', async () => {
    const harness = buildHarness()
    const first = await harness.statements.generate(input(), SALES)
    const second = await harness.statements.generate(input(), SALES)

    expect(first.version).toBe(1)
    expect(second.version).toBe(2)
    expect(second.id).not.toBe(first.id)
  })

  it('重算不修改旧版的状态与金额', async () => {
    const harness = buildHarness()
    const first = await harness.statements.generate(input(), SALES)
    const sent = await harness.statements.send(first.id, first.versionLock, SALES)

    await shipOne(harness)
    await harness.statements.generate(input(), SALES)

    const reloaded = await harness.statements.load(sent.id)
    expect(reloaded.status).toBe('SENT')
    expect(reloaded.shippedAmountMinor).toBe(0n)
  })

  it('不同期间各自从 1 开始编版本', async () => {
    const harness = buildHarness()
    await harness.statements.generate(input(), SALES)
    const other = await harness.statements.generate(
      input({
        periodFrom: new Date('1990-01-01T00:00:00Z'),
        periodTo: new Date('1990-12-31T00:00:00Z'),
      }),
      SALES,
    )

    expect(other.version).toBe(1)
  })

  it('latestOnly 只留每个客户 + 期间的最新一版', async () => {
    const harness = buildHarness()
    await harness.statements.generate(input(), SALES)
    await harness.statements.generate(input(), SALES)

    const all = await harness.statements.list({ limit: 50 })
    const latest = await harness.statements.list({ limit: 50, latestOnly: true })

    expect(all).toHaveLength(2)
    expect(latest).toHaveLength(1)
    expect(latest[0]?.version).toBe(2)
  })
})

describe('差异非零必须说明', () => {
  function record(overrides: Partial<StatementRecord>): StatementRecord {
    return { differenceAmountMinor: 0n, differenceNote: null, ...overrides } as StatementRecord
  }

  it('差异为零时不要求说明', () => {
    expect(() => assertDifferenceExplained(record({}))).not.toThrow()
  })

  it('差异非零且没写说明时拒绝', () => {
    expect(() => assertDifferenceExplained(record({ differenceAmountMinor: 44_820n }))).toThrow(
      expect.objectContaining({ code: 'ORD_2602' }),
    )
  })

  it('只填了空白也算没写', () => {
    expect(() =>
      assertDifferenceExplained(record({ differenceAmountMinor: 1n, differenceNote: '   ' })),
    ).toThrow(expect.objectContaining({ code: 'ORD_2602' }))
  })

  it('写了说明就放行', () => {
    expect(() =>
      assertDifferenceExplained(
        record({ differenceAmountMinor: 1n, differenceNote: '客户已扣款，红字待返工结案后开' }),
      ),
    ).not.toThrow()
  })

  it('差异为负数（客户多记）同样要说明', () => {
    expect(() => assertDifferenceExplained(record({ differenceAmountMinor: -500n }))).toThrow(
      expect.objectContaining({ code: 'ORD_2602' }),
    )
  })

  it('发出这一步会真的卡住没说明的差异', async () => {
    const harness = buildHarness()
    await shipOne(harness)
    const statement = await harness.statements.generate(
      input({ customerClosingMinor: 0n }),
      SALES,
    )

    expect(statement.differenceAmountMinor).not.toBe(0n)
    await expect(
      harness.statements.send(statement.id, statement.versionLock, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2602' })
  })
})

describe('对账单状态流转', () => {
  it('草稿 → 发出 → 确认 → 结清', async () => {
    const harness = buildHarness()
    const draft = await harness.statements.generate(input(), SALES)
    const sent = await harness.statements.send(draft.id, draft.versionLock, SALES)
    const confirmed = await harness.statements.confirm(sent.id, sent.versionLock, SALES)
    const settled = await harness.statements.settle(confirmed.id, confirmed.versionLock, SALES)

    expect(sent.sentAt).toBeInstanceOf(Date)
    expect(confirmed.confirmedAt).toBeInstanceOf(Date)
    expect(settled.status).toBe('SETTLED')
  })

  it('争议不是终点：处理完差异可以重新发出', async () => {
    const harness = buildHarness()
    const draft = await harness.statements.generate(input(), SALES)
    const sent = await harness.statements.send(draft.id, draft.versionLock, SALES)
    const disputed = await harness.statements.dispute(
      sent.id,
      sent.versionLock,
      'RMA 未冲减，回源单处理',
      SALES,
    )
    const resent = await harness.statements.send(disputed.id, disputed.versionLock, SALES)

    expect(disputed.differenceNote).toContain('回源单处理')
    expect(resent.status).toBe('SENT')
  })

  it('争议必须写说明', async () => {
    const harness = buildHarness()
    const draft = await harness.statements.generate(input(), SALES)
    const sent = await harness.statements.send(draft.id, draft.versionLock, SALES)

    await expect(
      harness.statements.dispute(sent.id, sent.versionLock, '  ', SALES),
    ).rejects.toMatchObject({ code: 'ORD_2602' })
  })

  it('草稿不能直接确认，得先发出去', async () => {
    const harness = buildHarness()
    const draft = await harness.statements.generate(input(), SALES)

    await expect(
      harness.statements.confirm(draft.id, draft.versionLock, SALES),
    ).rejects.toMatchObject({ code: 'SYS_9012' })
  })

  it('版本冲突时报 ORD_2601', async () => {
    const harness = buildHarness()
    const draft = await harness.statements.generate(input(), SALES)

    await expect(
      harness.statements.send(draft.id, draft.versionLock + 3, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2601' })
  })

  it('查不到的对账单抛 404', async () => {
    const harness = buildHarness()
    await expect(harness.statements.load('NOPE')).rejects.toMatchObject({ code: 'ORD_2600' })
  })
})

describe('客户核对状态是唯一可人工改的字段', () => {
  it('标记某行已核对', async () => {
    const harness = buildHarness()
    await shipOne(harness)
    const statement = await harness.statements.generate(input(), SALES)
    const lineId = statement.lines[0]!.id

    const updated = await harness.statements.setLineMatched(statement.id, lineId, true, SALES)

    expect(updated.lines[0]?.matched).toBe(true)
    expect(updated.lines[1]?.matched).toBe(false)
  })

  it('行不存在时报 404', async () => {
    const harness = buildHarness()
    const statement = await harness.statements.generate(input(), SALES)

    await expect(
      harness.statements.setLineMatched(statement.id, 'NOPE', true, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2605' })
  })

  it('非业务岗位改不了', async () => {
    const harness = buildHarness()
    const statement = await harness.statements.generate(input(), SALES)

    await expect(
      harness.statements.setLineMatched(statement.id, 'X', true, OUTSIDER),
    ).rejects.toMatchObject({ code: 'ORD_2606' })
  })
})
