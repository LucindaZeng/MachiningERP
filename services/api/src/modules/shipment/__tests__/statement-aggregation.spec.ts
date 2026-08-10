import {
  aggregateStatement,
  countsTowardReturns,
  orderEntries,
  signedAmountOf,
} from '../services/statement-aggregation'

import type { AggregationEntry } from '../services/statement-aggregation'
import type { StatementLineType } from '@prisma/client'

function entry(
  type: StatementLineType,
  amountMinor: bigint,
  day = '2026-07-06',
  docNo = `DOC-${type}`,
): AggregationEntry {
  return {
    occurredAt: new Date(`${day}T00:00:00Z`),
    type,
    docNo,
    productName: null,
    quantity: null,
    amountMinor,
    remark: null,
  }
}

describe('明细金额的正负号由单据类型决定', () => {
  it.each<[StatementLineType, bigint]>([
    ['SHIPMENT', 100n],
    ['INVOICE', 100n],
    ['RECEIPT', -100n],
    ['RETURN', -100n],
    ['ALLOWANCE', -100n],
  ])('%s → %s', (type, expected) => {
    expect(signedAmountOf(type, 100n)).toBe(expected)
  })

  it('源单给了负数也按类型规范化，不会出现双重取负', () => {
    expect(signedAmountOf('RECEIPT', -100n)).toBe(-100n)
    expect(signedAmountOf('SHIPMENT', -100n)).toBe(100n)
  })
})

describe('期末 = 期初 + 本期计入 − 回款 − 退货折让', () => {
  const entries = [
    entry('SHIPMENT', 3_184_000n),
    entry('INVOICE', 3_184_000n),
    entry('RECEIPT', 3_000_000n, '2026-07-20'),
    entry('RETURN', 477_600n, '2026-07-26'),
  ]

  it('发货制把已发未开票也算进应收', () => {
    const totals = aggregateStatement({
      openingBalanceMinor: 48_620_000n,
      basis: 'SHIPMENT',
      entries,
      overdueAmountMinor: 12_680_000n,
    })

    expect(totals.shippedAmountMinor).toBe(3_184_000n)
    expect(totals.invoicedAmountMinor).toBe(3_184_000n)
    expect(totals.receivedAmountMinor).toBe(3_000_000n)
    expect(totals.returnAmountMinor).toBe(477_600n)
    expect(totals.closingBalanceMinor).toBe(48_620_000n + 3_184_000n - 3_000_000n - 477_600n)
    expect(totals.overdueAmountMinor).toBe(12_680_000n)
  })

  it('开票制只认已开票金额', () => {
    const shippedOnly = [entry('SHIPMENT', 4_800_000n), entry('RECEIPT', 1_000_000n)]
    const totals = aggregateStatement({
      openingBalanceMinor: 0n,
      basis: 'INVOICE',
      entries: shippedOnly,
      overdueAmountMinor: 0n,
    })

    // 发了 48000 但一张票没开：开票制下本期不计应收，期末因此是负的回款
    expect(totals.shippedAmountMinor).toBe(4_800_000n)
    expect(totals.invoicedAmountMinor).toBe(0n)
    expect(totals.closingBalanceMinor).toBe(-1_000_000n)
  })

  it('退货与折让都进 returnAmount 同一栏', () => {
    const totals = aggregateStatement({
      openingBalanceMinor: 0n,
      basis: 'SHIPMENT',
      entries: [entry('RETURN', 100n), entry('ALLOWANCE', 50n)],
      overdueAmountMinor: 0n,
    })

    expect(totals.returnAmountMinor).toBe(150n)
  })

  it('源单把回款写成负数时汇总照样取绝对值，不会加成正的', () => {
    const totals = aggregateStatement({
      openingBalanceMinor: 1_000n,
      basis: 'SHIPMENT',
      entries: [entry('RECEIPT', -400n), entry('RETURN', -100n)],
      overdueAmountMinor: 0n,
    })

    expect(totals.receivedAmountMinor).toBe(400n)
    expect(totals.returnAmountMinor).toBe(100n)
    expect(totals.closingBalanceMinor).toBe(500n)
  })

  it('没有任何流水时期末等于期初', () => {
    const totals = aggregateStatement({
      openingBalanceMinor: 4_260_000n,
      basis: 'SHIPMENT',
      entries: [],
      overdueAmountMinor: 0n,
    })

    expect(totals.closingBalanceMinor).toBe(4_260_000n)
  })
})

describe('差异只有在客户报了自己账面余额时才算', () => {
  const base = {
    openingBalanceMinor: 1_000n,
    basis: 'SHIPMENT' as const,
    entries: [entry('SHIPMENT', 500n)],
    overdueAmountMinor: 0n,
  }

  it('没给客户余额 → 差异 0', () => {
    expect(aggregateStatement(base).differenceAmountMinor).toBe(0n)
  })

  it('显式传 null → 差异 0', () => {
    expect(
      aggregateStatement({ ...base, customerClosingMinor: null }).differenceAmountMinor,
    ).toBe(0n)
  })

  it('客户账面少记时差异为正', () => {
    expect(
      aggregateStatement({ ...base, customerClosingMinor: 1_100n }).differenceAmountMinor,
    ).toBe(400n)
  })

  it('客户账面多记时差异为负', () => {
    expect(
      aggregateStatement({ ...base, customerClosingMinor: 2_000n }).differenceAmountMinor,
    ).toBe(-500n)
  })

  it('两边一致时差异恰好是 0，而不是「约等于 0」', () => {
    expect(
      aggregateStatement({ ...base, customerClosingMinor: 1_500n }).differenceAmountMinor,
    ).toBe(0n)
  })
})

describe('明细排序保证重算稳定', () => {
  it('按发生日期排，同日按单号排', () => {
    const shuffled = [
      entry('RECEIPT', 1n, '2026-07-20', 'RCP-2'),
      entry('SHIPMENT', 1n, '2026-07-06', 'SHP-1'),
      entry('INVOICE', 1n, '2026-07-06', 'INV-1'),
    ]

    expect(orderEntries(shuffled).map((item) => item.docNo)).toEqual(['INV-1', 'SHP-1', 'RCP-2'])
  })

  it('不改动传入的数组', () => {
    const input = [entry('RECEIPT', 1n, '2026-07-20'), entry('SHIPMENT', 1n, '2026-07-06')]
    orderEntries(input)

    expect(input[0]?.type).toBe('RECEIPT')
  })
})

describe('红字发票冲减开票额，而不是累加', () => {
  it('开票列按带符号汇总：正票 + 红字 = 净开票额', () => {
    const totals = aggregateStatement({
      openingBalanceMinor: 0n,
      basis: 'INVOICE',
      entries: [entry('INVOICE', 14_039_120n), entry('INVOICE', -4_000_000n, '2026-07-20')],
      overdueAmountMinor: 0n,
    })

    expect(totals.invoicedAmountMinor).toBe(10_039_120n)
    expect(totals.closingBalanceMinor).toBe(10_039_120n)
  })

  it('明细行上的开票金额保留来源符号，红冲仍是负数', () => {
    expect(signedAmountOf('INVOICE', -4_000_000n)).toBe(-4_000_000n)
    expect(signedAmountOf('INVOICE', 4_000_000n)).toBe(4_000_000n)
  })

  it('全额红冲后净开票额归零', () => {
    const totals = aggregateStatement({
      openingBalanceMinor: 0n,
      basis: 'INVOICE',
      entries: [entry('INVOICE', 100n), entry('INVOICE', -100n)],
      overdueAmountMinor: 0n,
    })

    expect(totals.invoicedAmountMinor).toBe(0n)
  })
})

/**
 * 同一笔退款在账上有两条痕迹：RMA 结案的扣减，和财务为它开的红字发票。
 * 两条都是真的，但客户只该被减一次。这组测试钉住「每种口径只认一个规范来源」。
 */
describe('退款不得重复冲减：口径决定谁是规范来源', () => {
  function settledReturn(amountMinor: bigint): AggregationEntry {
    return { ...entry('RETURN', amountMinor), settledByCreditNote: true }
  }

  it('开票制：红字已把开票列减过，RMA 那笔扣减必须让位', () => {
    const totals = aggregateStatement({
      openingBalanceMinor: 0n,
      basis: 'INVOICE',
      entries: [
        entry('INVOICE', 1_000n),
        // 红字发票本身就是一张负数发票
        entry('INVOICE', -300n, '2026-07-20', 'DOC-CREDIT'),
        settledReturn(300n),
      ],
      overdueAmountMinor: 0n,
    })

    expect(totals.invoicedAmountMinor).toBe(700n)
    expect(totals.returnAmountMinor).toBe(0n)
    // 700 而不是 400：只减了一次
    expect(totals.closingBalanceMinor).toBe(700n)
  })

  it('发货制：红字只动开票这个展示列，RMA 那笔扣减照样算数', () => {
    const totals = aggregateStatement({
      openingBalanceMinor: 0n,
      basis: 'SHIPMENT',
      entries: [
        entry('SHIPMENT', 1_000n),
        entry('INVOICE', 1_000n),
        entry('INVOICE', -300n, '2026-07-20', 'DOC-CREDIT'),
        settledReturn(300n),
      ],
      overdueAmountMinor: 0n,
    })

    expect(totals.returnAmountMinor).toBe(300n)
    expect(totals.closingBalanceMinor).toBe(700n)
  })

  it('没被红字承接的扣减，两种口径下都算', () => {
    for (const basis of ['SHIPMENT', 'INVOICE'] as const) {
      const totals = aggregateStatement({
        openingBalanceMinor: 0n,
        basis,
        entries: [entry('SHIPMENT', 1_000n), entry('INVOICE', 1_000n), entry('RETURN', 300n)],
        overdueAmountMinor: 0n,
      })
      expect(totals.returnAmountMinor).toBe(300n)
    }
  })

  it('让步折让同样受这条规则管', () => {
    const totals = aggregateStatement({
      openingBalanceMinor: 0n,
      basis: 'INVOICE',
      entries: [
        entry('INVOICE', 1_000n),
        { ...entry('ALLOWANCE', 200n), settledByCreditNote: true },
        entry('ALLOWANCE', 50n, '2026-07-21', 'DOC-ALLOWANCE-2'),
      ],
      overdueAmountMinor: 0n,
    })
    expect(totals.returnAmountMinor).toBe(50n)
  })

  it('countsTowardReturns 只对退货侧的两类作答', () => {
    expect(countsTowardReturns(entry('SHIPMENT', 100n), 'INVOICE')).toBe(false)
    expect(countsTowardReturns(entry('RECEIPT', 100n), 'SHIPMENT')).toBe(false)
    expect(countsTowardReturns(entry('RETURN', 100n), 'SHIPMENT')).toBe(true)
    expect(countsTowardReturns(entry('ALLOWANCE', 100n), 'INVOICE')).toBe(true)
  })
})
