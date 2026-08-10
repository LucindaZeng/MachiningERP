import { StatementSourceRegistry } from '../../shipment'
import { ReturnStatementSource } from '../services/return-statement-source'

import { FakeSalesReturnRepository } from './fakes'

import type { SalesReturnRecord } from '../repositories/sales-return.repository.port'
import type { ReturnDisposition } from '@prisma/client'

const JULY = new Date('2026-07-01T00:00:00Z')
const AUGUST_END = new Date('2026-08-31T23:59:59Z')

function closedReturn(
  dispositions: ReadonlyArray<{
    disposition: ReturnDisposition
    amountMinor: bigint
    allowanceMinor?: bigint | null
    settledByCreditNote?: boolean
  }>,
  closedAt: Date,
): SalesReturnRecord {
  return {
    id: 'RMA-X',
    docNo: 'RMA-20260726-0009',
    orderId: 'O1',
    shipmentId: 'SH1',
    customerId: 'C1',
    currency: 'CNY',
    reason: '孔位尺寸超差',
    eightDNo: '8D-26-0031',
    eightDRequired: true,
    status: 'CLOSED',
    ownerUserCode: 'WFX-2018-0042',
    complaintAt: new Date('2026-07-26T09:20:00Z'),
    respondedAt: null,
    judgedAt: null,
    judgedBy: null,
    approvedAt: null,
    approvedBy: null,
    closedAt,
    needFinanceApproval: false,
    rejectReason: null,
    versionLock: 3,
    lines: dispositions.map((item, index) => ({
      id: `L${index + 1}`,
      sequence: index + 1,
      shipmentLineId: `SL${index + 1}`,
      orderLineId: `OL${index + 1}`,
      productName: `产品${index + 1}`,
      drawingNo: 'MT-7601',
      batchNo: 'B26070901',
      returnQty: '120.000000',
      unitPriceMinor: 3_980n,
      amountMinor: item.amountMinor,
      reason: '平面度超差',
      responsibility: 'COMPANY' as const,
      disposition: item.disposition,
      dispositionNote: '按方案处理',
      allowanceMinor: item.allowanceMinor ?? null,
      receivedAt: new Date('2026-07-27T10:30:00Z'),
      receivedQty: '120.000000',
      settledByCreditNote: item.settledByCreditNote ?? false,
      creditNoteDocNo: item.settledByCreditNote ? 'INV-26-0900' : null,
    })),
  }
}

function build(): { source: ReturnStatementSource; repo: FakeSalesReturnRepository; registry: StatementSourceRegistry } {
  const repo = new FakeSalesReturnRepository()
  const registry = new StatementSourceRegistry()
  return { source: new ReturnStatementSource(registry, repo), repo, registry }
}

describe('对账「退货折让」列的真实来源', () => {
  it('启动时把自己插进 shipment 那个一直空着的槽位', () => {
    const { source, registry } = build()
    expect(registry.wiring.returns).toBe(false)
    source.onModuleInit()
    expect(registry.wiring.returns).toBe(true)
  })

  it('退款算 RETURN、让步算 ALLOWANCE，且让步只报折让额', async () => {
    const { source, repo } = build()
    repo.rows.push(
      closedReturn(
        [
          { disposition: 'REFUND', amountMinor: 477_600n },
          { disposition: 'CONCESSION', amountMinor: 64_800n, allowanceMinor: 20_000n },
        ],
        new Date('2026-07-30T00:00:00Z'),
      ),
    )

    const entries = await source.returnsInPeriod('C1', JULY, AUGUST_END)
    expect(entries.map((entry) => [entry.lineType, entry.amountMinor])).toEqual([
      ['RETURN', 477_600n],
      ['ALLOWANCE', 20_000n],
    ])
  })

  it('返工与补货一条都不出现——它们不改变任何应收', async () => {
    const { source, repo } = build()
    repo.rows.push(
      closedReturn(
        [
          { disposition: 'REWORK', amountMinor: 477_600n },
          { disposition: 'REPLACEMENT', amountMinor: 64_800n },
        ],
        new Date('2026-07-30T00:00:00Z'),
      ),
    )

    expect(await source.returnsInPeriod('C1', JULY, AUGUST_END)).toEqual([])
  })

  it('按结案日落期间：七月登记、八月结案的退货算八月', async () => {
    const { source, repo } = build()
    repo.rows.push(
      closedReturn([{ disposition: 'REFUND', amountMinor: 100n }], new Date('2026-08-03T00:00:00Z')),
    )

    const july = await source.returnsInPeriod('C1', JULY, new Date('2026-07-31T23:59:59Z'))
    const august = await source.returnsInPeriod('C1', new Date('2026-08-01T00:00:00Z'), AUGUST_END)
    expect(july).toEqual([])
    expect(august).toHaveLength(1)
  })

  it('没结案的单一条都不出来——金额还没定死', async () => {
    const { source, repo } = build()
    const open = closedReturn([{ disposition: 'REFUND', amountMinor: 100n }], new Date('2026-07-30T00:00:00Z'))
    open.status = 'EXECUTING'
    open.closedAt = null
    repo.rows.push(open)

    expect(await source.returnsInPeriod('C1', JULY, AUGUST_END)).toEqual([])
  })

  it('已由红字发票承接的行带着标志出来，供开票制口径避免重复冲减', async () => {
    const { source, repo } = build()
    repo.rows.push(
      closedReturn(
        [
          { disposition: 'REFUND', amountMinor: 100n, settledByCreditNote: true },
          { disposition: 'REFUND', amountMinor: 200n },
        ],
        new Date('2026-07-30T00:00:00Z'),
      ),
    )

    const entries = await source.returnsInPeriod('C1', JULY, AUGUST_END)
    expect(entries.map((entry) => entry.settledByCreditNote)).toEqual([true, false])
  })

  it('备注优先取处置理由，缺省回落到该行的不良现象', async () => {
    const { source, repo } = build()
    const record = closedReturn(
      [{ disposition: 'REFUND', amountMinor: 100n }],
      new Date('2026-07-30T00:00:00Z'),
    )
    record.lines[0]!.dispositionNote = null
    repo.rows.push(record)

    const entries = await source.returnsInPeriod('C1', JULY, AUGUST_END)
    expect(entries[0]!.remark).toBe('平面度超差')
  })
})
