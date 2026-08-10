import { SALES_RETURN_ERRORS } from '@machining-erp/shared'

import { SalesOrderService } from '../../contract-order'
import { UserDirectoryService } from '../../identity'
import { CustomerService } from '../../masterdata'
import { ShipmentService } from '../../shipment'
import { ReturnContextService } from '../services/return-context.service'
import {
  assertClosable,
  assertDispositionsResolved,
  factsOf,
  pendingReceiptLines,
} from '../services/return-flow.service'
import {
  toDispositionInputs,
  toJudgeInputs,
  toReturnLineDrafts,
  toReturnQuery,
} from '../services/return-input.mapper'

import { SALES, buildHarness, registerTwoLine } from './harness'

import type { Harness } from './harness'
import type { SalesReturnRecord } from '../repositories/sales-return.repository.port'

describe('HTTP 形状 → 领域形状', () => {
  it('金额字符串转 bigint，orderLineId 缺省补 null', () => {
    const drafts = toReturnLineDrafts({
      shipmentId: 'SH1',
      reason: 'x',
      complaintAt: '2026-07-26T09:20:00Z',
      lines: [
        {
          sequence: 1,
          shipmentLineId: 'SL1',
          productName: '导轨压板',
          drawingNo: 'MT-7601',
          batchNo: 'B1',
          returnQty: '120',
          unitPriceMinor: '3980',
          amountMinor: '477600',
          reason: '平面度超差',
        },
      ],
    })
    expect(drafts[0]).toMatchObject({
      orderLineId: null,
      unitPriceMinor: 3_980n,
      amountMinor: 477_600n,
    })
  })

  it('判定入参原样透传', () => {
    const inputs = toJudgeInputs({
      versionLock: 0,
      lines: [{ lineId: 'L1', responsibility: 'SUPPLIER' }],
    })
    expect(inputs).toEqual([{ lineId: 'L1', responsibility: 'SUPPLIER' }])
  })

  it('折让额：空串与缺省都当作「没填」，不能变成 0n', () => {
    const inputs = toDispositionInputs({
      versionLock: 0,
      lines: [
        { lineId: 'L1', disposition: 'CONCESSION', allowanceMinor: '20000' },
        { lineId: 'L2', disposition: 'CONCESSION', allowanceMinor: '' },
        { lineId: 'L3', disposition: 'REFUND' },
      ],
    })
    expect(inputs.map((item) => item.allowanceMinor)).toEqual([20_000n, null, null])
    expect(inputs.map((item) => item.dispositionNote)).toEqual([null, null, null])
  })

  it('查询条件：只带上真正填了的字段，日期转 Date', () => {
    expect(toReturnQuery({})).toEqual({})

    const full = toReturnQuery({
      customerId: 'C1',
      orderId: 'O1',
      shipmentId: 'SH1',
      status: 'CLOSED',
      ownerUserCode: 'WFX-2018-0042',
      closedFrom: '2026-07-01T00:00:00Z',
      closedTo: '2026-07-31T00:00:00Z',
    })
    expect(full.closedFrom).toBeInstanceOf(Date)
    expect(full.closedTo).toBeInstanceOf(Date)
    expect(full.status).toBe('CLOSED')
  })
})

describe('跨模块取数只走对方的公开出口', () => {
  function build(shipmentNo = 'SHP-20260702-0043'): ReturnContextService {
    const shipments = {
      load: jest.fn(async () => ({
        id: 'SH1',
        docNo: shipmentNo,
        orderId: 'O1',
        customerId: 'C1',
        currency: 'CNY',
        lines: [
          {
            id: 'SL1',
            orderLineId: 'OL1',
            productName: '导轨压板',
            drawingNo: 'MT-7601',
            batchNo: 'B1',
            shippedQty: '1200.000000',
            unitPriceMinor: 3_980n,
          },
        ],
      })),
    } as unknown as ShipmentService
    const orders = {
      load: jest.fn(async () => ({ id: 'O1', docNo: 'SO-20260620-0071' })),
    } as unknown as SalesOrderService
    const customers = {
      profileFor: jest.fn(async () => ({ name: '苏州明泰自动化' })),
    } as unknown as CustomerService
    const users = {
      findByUserCode: jest.fn(async (code: string) =>
        code === 'WFX-2018-0042' ? { displayName: '罗晓琳' } : null,
      ),
    } as unknown as UserDirectoryService

    return new ReturnContextService(shipments, orders, customers, users)
  }

  it('出货上下文把订单、客户、币种一并带出', async () => {
    const context = await build().shipmentContext('SH1')
    expect(context).toMatchObject({ orderId: 'O1', customerId: 'C1', currency: 'CNY' })
    expect(context.lines[0]!.shipmentLineId).toBe('SL1')
  })

  it('查不到姓名时退回工号——宁可显示工号也不要空白', async () => {
    const context = build()
    expect(await context.displayName('WFX-2018-0042')).toBe('罗晓琳')
    expect(await context.displayName('WFX-9999-9999')).toBe('WFX-9999-9999')
  })

  it('客户名直接取档案', async () => {
    expect(await build().customerName('C1')).toBe('苏州明泰自动化')
  })

  it('namingFor 一次取齐四个名字', async () => {
    const naming = await build().namingFor('C1', 'WFX-2018-0042', 'SH1', 'O1')
    expect(naming).toEqual({
      customerName: '苏州明泰自动化',
      ownerName: '罗晓琳',
      shipmentNo: 'SHP-20260702-0043',
      orderNo: 'SO-20260620-0071',
    })
  })

  it('无出货关联时单号显示占位符，不去查一个不存在的出货单', async () => {
    const naming = await build().namingFor('C1', 'WFX-2018-0042', null, 'O1')
    expect(naming.shipmentNo).toBe('—')
  })
})

describe('闸门的导出纯函数', () => {
  let harness: Harness
  let record: SalesReturnRecord

  beforeEach(async () => {
    harness = buildHarness()
    record = await registerTwoLine(harness)
  })

  it('factsOf 把 Prisma 记录压成规则层认得的事实', () => {
    const facts = factsOf(record)
    expect(facts).toHaveLength(2)
    expect(facts[0]).toMatchObject({ sequence: 1, disposition: 'UNDECIDED', allowanceMinor: null })
  })

  it('批准闸门放过「没收货」，结案闸门不放过', () => {
    const rework: SalesReturnRecord = {
      ...record,
      lines: record.lines.map((line) => ({
        ...line,
        responsibility: 'COMPANY' as const,
        disposition: 'REWORK' as const,
        receivedAt: null,
      })),
    }
    expect(() => assertDispositionsResolved(rework)).not.toThrow()
    expect(() => assertClosable(rework)).toThrow(
      expect.objectContaining({ code: SALES_RETURN_ERRORS.GOODS_NOT_RECEIVED.code }),
    )
  })

  it('两道闸门都放行时不抛', () => {
    const ready: SalesReturnRecord = {
      ...record,
      lines: record.lines.map((line) => ({
        ...line,
        responsibility: 'COMPANY' as const,
        disposition: 'REWORK' as const,
        receivedAt: new Date('2026-07-27T10:30:00Z'),
      })),
    }
    expect(() => assertDispositionsResolved(ready)).not.toThrow()
    expect(() => assertClosable(ready)).not.toThrow()
  })

  it('抛出的错误带上全部待办，业务员改一轮就能过', () => {
    try {
      assertClosable(record)
      throw new Error('应当抛错')
    } catch (error) {
      const details = (error as { details?: { issues?: string[] } }).details
      expect(details?.issues).toEqual([
        '第 1 行 导轨压板：责任归属未判定',
        '第 1 行 导轨压板：处置方式未确定',
        '第 2 行 定位销座：责任归属未判定',
        '第 2 行 定位销座：处置方式未确定',
      ])
    }
  })

  it('pendingReceiptLines 只报还没收货的返工行', () => {
    const mixed: SalesReturnRecord = {
      ...record,
      lines: [
        { ...record.lines[0]!, disposition: 'REWORK' as const, receivedAt: null },
        { ...record.lines[1]!, disposition: 'REFUND' as const, receivedAt: null },
      ],
    }
    expect(pendingReceiptLines(mixed)).toEqual([1])
  })
})

describe('结案锁与不存在的单据', () => {
  it('查不到就是 NOT_FOUND，不是空对象', async () => {
    const harness = buildHarness()
    await expect(harness.returns.load('nope')).rejects.toMatchObject({
      code: SALES_RETURN_ERRORS.NOT_FOUND.code,
    })
  })

  it('rejectReason 与 closedAt 只在有值时透出（视图可选字段的另一半分支）', async () => {
    const harness = buildHarness()
    const record = await registerTwoLine(harness)
    const handed = await harness.flow.respond(record.id, record.versionLock, SALES)
    const rejected = await harness.flow.reject(
      handed.id,
      handed.versionLock,
      '经复测尺寸合格',
      { userCode: 'WFX-2019-0088', permissions: ['quality.rma.judge'] },
    )
    const view = await harness.reads.render(rejected)
    expect(view.rejectReason).toBe('经复测尺寸合格')
    expect(view.respondedAt).toBeDefined()
    expect(view.closedAt).toBeUndefined()
  })
})
