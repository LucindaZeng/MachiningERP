import { SALES_RETURN_ERRORS } from '@machining-erp/shared'

import { DOMAIN_EVENTS } from '../../../platform/events'
import { assertReturnableLines } from '../services/sales-return.service'

import { FINANCE, OUTSIDER, QUALITY, SALES, SHIPPED_LINES, buildHarness, registerTwoLine } from './harness'

import type { Harness } from './harness'
import type { SalesReturnRecord } from '../repositories/sales-return.repository.port'

let harness: Harness

beforeEach(() => {
  harness = buildHarness()
})

/** 把一张单一路推到「执行中」，两行都判本厂责任、都走返工并已入库。 */
async function toExecuting(record: SalesReturnRecord): Promise<SalesReturnRecord> {
  const handed = await harness.flow.respond(record.id, record.versionLock, SALES)
  const judged = await harness.flow.judge(
    handed.id,
    handed.versionLock,
    handed.lines.map((line) => ({ lineId: line.id, responsibility: 'COMPANY' as const })),
    QUALITY,
  )
  const disposed = await harness.flow.submitDisposition(
    judged.id,
    judged.versionLock,
    judged.lines.map((line) => ({
      lineId: line.id,
      disposition: 'REWORK' as const,
      dispositionNote: null,
      allowanceMinor: null,
    })),
    SALES,
  )
  const received = await harness.flow.receiveGoods(
    disposed.id,
    disposed.versionLock,
    disposed.lines.map((line) => ({ lineId: line.id, receivedQty: line.returnQty })),
    SALES,
  )
  return harness.flow.approve(received.id, received.versionLock, SALES)
}

describe('RMA-01 登记', () => {
  it('登记后停在已登记，责任与处置一律待判定——登记人不给自己打分', async () => {
    const record = await registerTwoLine(harness)
    expect(record.status).toBe('REGISTERED')
    expect(record.lines.map((line) => line.responsibility)).toEqual(['UNDECIDED', 'UNDECIDED'])
    expect(record.lines.map((line) => line.disposition)).toEqual(['UNDECIDED', 'UNDECIDED'])
    expect(harness.timelineEnter).toHaveBeenCalledWith(
      expect.objectContaining({ node: 'RMA-01 业务登记客诉' }),
    )
  })

  it('没有业务权限登记不了', async () => {
    harness.repo.rows.length = 0
    await expect(
      harness.returns.register(
        {
          orderId: 'O1',
          shipmentId: 'SH1',
          customerId: 'C1',
          currency: 'CNY',
          reason: 'x',
          eightDNo: null,
          eightDRequired: false,
          complaintAt: new Date(),
          lines: [],
        },
        OUTSIDER,
        SHIPPED_LINES,
      ),
    ).rejects.toMatchObject({ code: SALES_RETURN_ERRORS.SALES_ROLE_REQUIRED.code })
  })

  it('首响打点与转品质判定是同一个动作，且天然只有一次', async () => {
    const record = await registerTwoLine(harness)
    const handed = await harness.flow.respond(record.id, record.versionLock, SALES)
    expect(handed.respondedAt).toBeInstanceOf(Date)
    expect(handed.status).toBe('QUALITY_JUDGING')

    // 已经离开 REGISTERED，状态机不许再响应一次
    await expect(harness.flow.respond(handed.id, handed.versionLock, SALES)).rejects.toThrow()
  })
})

describe('登记数量校验', () => {
  const line = {
    sequence: 1,
    shipmentLineId: 'SL1',
    orderLineId: 'OL1',
    productName: '导轨压板',
    drawingNo: 'MT-7601',
    batchNo: 'B26070901',
    returnQty: '120.000000',
    unitPriceMinor: 3_980n,
    amountMinor: 477_600n,
    reason: '平面度超差',
  }

  it('空单不成立', () => {
    expect(() => assertReturnableLines([], SHIPPED_LINES)).toThrow(
      expect.objectContaining({ code: SALES_RETURN_ERRORS.LINES_REQUIRED.code }),
    )
  })

  it('没挂出货行的不成立——没有批次追溯', () => {
    expect(() => assertReturnableLines([{ ...line, shipmentLineId: '' }], SHIPPED_LINES)).toThrow(
      expect.objectContaining({ code: SALES_RETURN_ERRORS.LINES_REQUIRED.code }),
    )
  })

  it('挂到别的出货单的行上也不成立', () => {
    expect(() =>
      assertReturnableLines([{ ...line, shipmentLineId: 'SL-OTHER' }], SHIPPED_LINES),
    ).toThrow(expect.objectContaining({ code: SALES_RETURN_ERRORS.LINES_REQUIRED.code }))
  })

  it('退得比发的多要拦住', () => {
    expect(() =>
      assertReturnableLines([{ ...line, returnQty: '1200.000001' }], SHIPPED_LINES),
    ).toThrow(expect.objectContaining({ code: SALES_RETURN_ERRORS.QTY_EXCEEDS_SHIPPED.code }))
  })

  it('全退（正好等于实发数）是允许的', () => {
    expect(() =>
      assertReturnableLines([{ ...line, returnQty: '1200.000000' }], SHIPPED_LINES),
    ).not.toThrow()
  })
})

/** 登记 → 首响转品质，落在「品质判定中」。 */
async function toJudging(): Promise<SalesReturnRecord> {
  const record = await registerTwoLine(harness)
  return harness.flow.respond(record.id, record.versionLock, SALES)
}

describe('RMA-02 品质判定', () => {
  it('业务判不了责任——被投诉方不能给自己打分', async () => {
    const record = await toJudging()
    await expect(
      harness.flow.judge(
        record.id,
        record.versionLock,
        [{ lineId: record.lines[0]!.id, responsibility: 'CUSTOMER' }],
        SALES,
      ),
    ).rejects.toMatchObject({ code: SALES_RETURN_ERRORS.QUALITY_ROLE_REQUIRED.code })
  })

  it('可以给同一张单的两行判不同责任——fixture RT1 正是这种情况', async () => {
    const record = await toJudging()
    const judged = await harness.flow.judge(
      record.id,
      record.versionLock,
      [
        { lineId: record.lines[0]!.id, responsibility: 'COMPANY' },
        { lineId: record.lines[1]!.id, responsibility: 'SUPPLIER' },
      ],
      QUALITY,
    )
    expect(judged.lines.map((line) => line.responsibility)).toEqual(['COMPANY', 'SUPPLIER'])
    expect(judged.status).toBe('DISPOSITION')
    expect(judged.judgedBy).toBe(QUALITY.userCode)
  })

  it('乐观锁不匹配时拒绝', async () => {
    const record = await toJudging()
    await expect(
      harness.flow.judge(
        record.id,
        record.versionLock + 5,
        [{ lineId: record.lines[0]!.id, responsibility: 'COMPANY' }],
        QUALITY,
      ),
    ).rejects.toMatchObject({ code: SALES_RETURN_ERRORS.NOT_EDITABLE.code })
  })
})

describe('RMA-03 处置与升级', () => {
  async function judged(): Promise<SalesReturnRecord> {
    const record = await toJudging()
    return harness.flow.judge(
      record.id,
      record.versionLock,
      record.lines.map((line) => ({ lineId: line.id, responsibility: 'COMPANY' as const })),
      QUALITY,
    )
  }

  it('返工 + 报废不升级财务', async () => {
    const record = await judged()
    const disposed = await harness.flow.submitDisposition(
      record.id,
      record.versionLock,
      [
        { lineId: record.lines[0]!.id, disposition: 'REWORK', dispositionNote: null, allowanceMinor: null },
        { lineId: record.lines[1]!.id, disposition: 'SCRAP', dispositionNote: '整批报废', allowanceMinor: null },
      ],
      SALES,
    )
    expect(disposed.needFinanceApproval).toBe(false)
    expect(harness.notify).not.toHaveBeenCalled()
  })

  it('只要有一行退款就升级，并给业务员发通知', async () => {
    const record = await judged()
    const disposed = await harness.flow.submitDisposition(
      record.id,
      record.versionLock,
      [
        { lineId: record.lines[0]!.id, disposition: 'REWORK', dispositionNote: null, allowanceMinor: null },
        { lineId: record.lines[1]!.id, disposition: 'REFUND', dispositionNote: '客户要求退款', allowanceMinor: null },
      ],
      SALES,
    )
    expect(disposed.needFinanceApproval).toBe(true)
    expect(harness.notify).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'SALES_RETURN', recipientUserCode: disposed.ownerUserCode }),
    )
  })

  it('升级后必须由财务批，业务批不动', async () => {
    const record = await judged()
    const disposed = await harness.flow.submitDisposition(
      record.id,
      record.versionLock,
      record.lines.map((line) => ({
        lineId: line.id,
        disposition: 'REFUND' as const,
        dispositionNote: '客户要求退款',
        allowanceMinor: null,
      })),
      SALES,
    )
    await expect(harness.flow.approve(disposed.id, disposed.versionLock, SALES)).rejects.toMatchObject(
      { code: SALES_RETURN_ERRORS.FINANCE_ROLE_REQUIRED.code },
    )

    const approved = await harness.flow.approve(disposed.id, disposed.versionLock, FINANCE)
    expect(approved.status).toBe('EXECUTING')
    expect(approved.approvedBy).toBe(FINANCE.userCode)
  })

  it('还有行没定处置就批不下去', async () => {
    const record = await judged()
    await expect(harness.flow.approve(record.id, record.versionLock, SALES)).rejects.toMatchObject({
      code: SALES_RETURN_ERRORS.LINE_DISPOSITION_REQUIRED.code,
    })
  })

  it('批准闸门不管收货——批的是方案，收货是执行环节的事', async () => {
    const record = await judged()
    const disposed = await harness.flow.submitDisposition(
      record.id,
      record.versionLock,
      record.lines.map((line) => ({
        lineId: line.id,
        disposition: 'REWORK' as const,
        dispositionNote: null,
        allowanceMinor: null,
      })),
      SALES,
    )
    const approved = await harness.flow.approve(disposed.id, disposed.versionLock, SALES)
    expect(approved.status).toBe('EXECUTING')
  })

  it('让步没录折让额批不下去', async () => {
    const record = await judged()
    const disposed = await harness.flow.submitDisposition(
      record.id,
      record.versionLock,
      record.lines.map((line) => ({
        lineId: line.id,
        disposition: 'CONCESSION' as const,
        dispositionNote: '客户降价使用',
        allowanceMinor: null,
      })),
      SALES,
    )
    await expect(harness.flow.approve(disposed.id, disposed.versionLock, FINANCE)).rejects.toMatchObject(
      { code: SALES_RETURN_ERRORS.ALLOWANCE_AMOUNT_REQUIRED.code },
    )
  })
})

describe('判定不成立', () => {
  it('理由必填', async () => {
    const record = await toJudging()
    await expect(
      harness.flow.reject(record.id, record.versionLock, '   ', QUALITY),
    ).rejects.toMatchObject({ code: SALES_RETURN_ERRORS.REJECT_REASON_REQUIRED.code })
  })

  it('不成立是终点，之后连改都不许', async () => {
    const record = await toJudging()
    const rejected = await harness.flow.reject(record.id, record.versionLock, '经复测尺寸合格', QUALITY)
    expect(rejected.status).toBe('REJECTED')
    expect(rejected.rejectReason).toBe('经复测尺寸合格')

    await expect(
      harness.flow.judge(
        rejected.id,
        rejected.versionLock,
        [{ lineId: rejected.lines[0]!.id, responsibility: 'COMPANY' }],
        QUALITY,
      ),
    ).rejects.toMatchObject({ code: SALES_RETURN_ERRORS.NOT_EDITABLE.code })
  })
})

describe('RMA-04 退货入库', () => {
  it('同一行不能重复登记入库，否则会重复计入不良仓', async () => {
    const record = await toJudging()
    const judgedRecord = await harness.flow.judge(
      record.id,
      record.versionLock,
      record.lines.map((line) => ({ lineId: line.id, responsibility: 'COMPANY' as const })),
      QUALITY,
    )
    const received = await harness.flow.receiveGoods(
      judgedRecord.id,
      judgedRecord.versionLock,
      [{ lineId: judgedRecord.lines[0]!.id, receivedQty: '120.000000' }],
      SALES,
    )
    await expect(
      harness.flow.receiveGoods(
        received.id,
        received.versionLock,
        [{ lineId: received.lines[0]!.id, receivedQty: '120.000000' }],
        SALES,
      ),
    ).rejects.toMatchObject({ code: SALES_RETURN_ERRORS.RECEIPT_ALREADY_RECORDED.code })
  })

  it('不存在的行报 LINE_NOT_FOUND', async () => {
    const record = await toJudging()
    await expect(
      harness.flow.receiveGoods(
        record.id,
        record.versionLock,
        [{ lineId: 'nope', receivedQty: '1' }],
        SALES,
      ),
    ).rejects.toMatchObject({ code: SALES_RETURN_ERRORS.LINE_NOT_FOUND.code })
  })
})

describe('RMA-05 结案', () => {
  it('返工没收到不良品就结不了案', async () => {
    const record = await toJudging()
    const judgedRecord = await harness.flow.judge(
      record.id,
      record.versionLock,
      record.lines.map((line) => ({ lineId: line.id, responsibility: 'COMPANY' as const })),
      QUALITY,
    )
    const disposed = await harness.flow.submitDisposition(
      judgedRecord.id,
      judgedRecord.versionLock,
      judgedRecord.lines.map((line) => ({
        lineId: line.id,
        disposition: 'REWORK' as const,
        dispositionNote: null,
        allowanceMinor: null,
      })),
      SALES,
    )
    const approved = await harness.flow.approve(disposed.id, disposed.versionLock, SALES)

    await expect(harness.flow.close(approved.id, approved.versionLock, SALES)).rejects.toMatchObject(
      { code: SALES_RETURN_ERRORS.GOODS_NOT_RECEIVED.code },
    )
  })

  it('结案打上 closedAt、发结案事件、发返工事件', async () => {
    const record = await registerTwoLine(harness)
    const executing = await toExecuting(record)
    const closed = await harness.flow.close(executing.id, executing.versionLock, SALES)

    expect(closed.status).toBe('CLOSED')
    expect(closed.closedAt).toBeInstanceOf(Date)

    const names = harness.publish.mock.calls.map((call) => call[0].name)
    expect(names).toContain(DOMAIN_EVENTS.SALES_RETURN_REWORK_REQUESTED)
    expect(names).toContain(DOMAIN_EVENTS.SALES_RETURN_CLOSED)
  })

  it('一行返工都没有就不发返工事件——空事件是噪音', async () => {
    const record = await toJudging()
    const judgedRecord = await harness.flow.judge(
      record.id,
      record.versionLock,
      record.lines.map((line) => ({ lineId: line.id, responsibility: 'COMPANY' as const })),
      QUALITY,
    )
    const disposed = await harness.flow.submitDisposition(
      judgedRecord.id,
      judgedRecord.versionLock,
      judgedRecord.lines.map((line) => ({
        lineId: line.id,
        disposition: 'REFUND' as const,
        dispositionNote: '客户要求退款',
        allowanceMinor: null,
      })),
      SALES,
    )
    const approved = await harness.flow.approve(disposed.id, disposed.versionLock, FINANCE)
    const closed = await harness.flow.close(approved.id, approved.versionLock, SALES)

    const names = harness.publish.mock.calls.map((call) => call[0].name)
    expect(names).not.toContain(DOMAIN_EVENTS.SALES_RETURN_REWORK_REQUESTED)
    expect(closed.status).toBe('CLOSED')
  })

  it('只把动钱的行推给财务 seam；全是返工时一次都不推', async () => {
    const record = await registerTwoLine(harness)
    const executing = await toExecuting(record)
    await harness.flow.close(executing.id, executing.versionLock, SALES)
    expect(harness.settlement.requests).toHaveLength(0)
  })

  it('退款 + 让步：推给财务的扣减金额取法各按各的', async () => {
    const record = await toJudging()
    const judgedRecord = await harness.flow.judge(
      record.id,
      record.versionLock,
      record.lines.map((line) => ({ lineId: line.id, responsibility: 'COMPANY' as const })),
      QUALITY,
    )
    const disposed = await harness.flow.submitDisposition(
      judgedRecord.id,
      judgedRecord.versionLock,
      [
        {
          lineId: judgedRecord.lines[0]!.id,
          disposition: 'REFUND',
          dispositionNote: '全额退款',
          allowanceMinor: null,
        },
        {
          lineId: judgedRecord.lines[1]!.id,
          disposition: 'CONCESSION',
          dispositionNote: '客户降价使用',
          allowanceMinor: 20_000n,
        },
      ],
      SALES,
    )
    const approved = await harness.flow.approve(disposed.id, disposed.versionLock, FINANCE)
    await harness.flow.close(approved.id, approved.versionLock, SALES)

    const request = harness.settlement.requests[0]!
    expect(request.lines.map((line) => line.deductionMinor)).toEqual([477_600n, 20_000n])
  })

  it('结案后金额与处置锁死——要更正只能另开单据', async () => {
    const record = await registerTwoLine(harness)
    const executing = await toExecuting(record)
    const closed = await harness.flow.close(executing.id, executing.versionLock, SALES)

    await expect(
      harness.flow.submitDisposition(
        closed.id,
        closed.versionLock,
        [
          {
            lineId: closed.lines[0]!.id,
            disposition: 'REFUND',
            dispositionNote: '事后想改成退款',
            allowanceMinor: null,
          },
        ],
        SALES,
      ),
    ).rejects.toMatchObject({ code: SALES_RETURN_ERRORS.CLOSED_IS_IMMUTABLE.code })

    const reloaded = await harness.returns.load(closed.id)
    expect(reloaded.lines.map((line) => line.disposition)).toEqual(['REWORK', 'REWORK'])
  })

  it('结案是终点：不能再结一次', async () => {
    const record = await registerTwoLine(harness)
    const executing = await toExecuting(record)
    const closed = await harness.flow.close(executing.id, executing.versionLock, SALES)
    await expect(harness.flow.close(closed.id, closed.versionLock, SALES)).rejects.toThrow()
  })
})
