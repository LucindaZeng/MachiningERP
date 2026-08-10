import { toReturnTimelineView } from '../services/return-timeline.mapper'
import { toSalesReturnView } from '../services/return-view.mapper'

import { QUALITY, SALES, buildHarness, registerTwoLine } from './harness'

import type { Harness } from './harness'
import type { TimelineNodeRecord } from '../../../platform/timeline'
import type { SalesReturnRecord } from '../repositories/sales-return.repository.port'
import type { ReturnNaming } from '../services/return-view.mapper'

const NAMING: ReturnNaming = {
  orderNo: 'SO-20260620-0071',
  shipmentNo: 'SHP-20260702-0043',
  customerName: '苏州明泰自动化',
  ownerName: '罗晓琳',
}

let harness: Harness

beforeEach(() => {
  harness = buildHarness()
})

async function judgedAs(
  first: 'COMPANY' | 'SUPPLIER',
  second: 'COMPANY' | 'SUPPLIER',
): Promise<SalesReturnRecord> {
  const record = await registerTwoLine(harness)
  const handed = await harness.flow.respond(record.id, record.versionLock, SALES)
  return harness.flow.judge(
    handed.id,
    handed.versionLock,
    [
      { lineId: handed.lines[0]!.id, responsibility: first },
      { lineId: handed.lines[1]!.id, responsibility: second },
    ],
    QUALITY,
  )
}

describe('单头派生值在映射时现算，不落库', () => {
  it('两行责任一致 → 单头取该值，不打 mixed 标记', async () => {
    const record = await judgedAs('COMPANY', 'COMPANY')
    const view = toSalesReturnView(record, NAMING, [])
    expect(view.responsibility).toBe('company')
    expect(view.mixedResponsibility).toBeUndefined()
  })

  it('fixture RT1 那种一单两责任 → 单头回落待判定并标记按行看', async () => {
    const record = await judgedAs('COMPANY', 'SUPPLIER')
    const view = toSalesReturnView(record, NAMING, [])
    expect(view.responsibility).toBe('undecided')
    expect(view.mixedResponsibility).toBe(true)
    // 真相在行上，两行各自的判定原样透出
    expect(view.lines.map((line) => line.responsibility)).toEqual(['company', 'supplier'])
  })

  it('处置未定时单头也是 undecided，且行上同样透出', async () => {
    const record = await registerTwoLine(harness)
    const view = toSalesReturnView(record, NAMING, [])
    expect(view.disposition).toBe('undecided')
    expect(view.lines.every((line) => line.disposition === 'undecided')).toBe(true)
  })
})

describe('金额与数量的表头汇总', () => {
  it('单头金额是各行之和，数量同理', async () => {
    const record = await registerTwoLine(harness)
    const view = toSalesReturnView(record, NAMING, [])
    // 477600 + 64800 = 542400 分 = 5424.00
    expect(view.amount).toEqual({ amount: '5424.00', currency: 'CNY' })
    expect(view.returnQty).toBe('150.000000')
  })

  it('多行表头产品名用「首行 等 N 项」，与前端 fixture 写法一致', async () => {
    const record = await registerTwoLine(harness)
    expect(toSalesReturnView(record, NAMING, []).productName).toBe('导轨压板 等 2 项')
  })

  it('单行时直接取行名', async () => {
    const record = await registerTwoLine(harness)
    const single = { ...record, lines: [record.lines[0]!] }
    expect(toSalesReturnView(single, NAMING, []).productName).toBe('导轨压板')
  })

  it('空行单据不炸：产品名与批次留空', async () => {
    const record = await registerTwoLine(harness)
    const empty = { ...record, lines: [] }
    const view = toSalesReturnView(empty, NAMING, [])
    expect(view.productName).toBe('')
    expect(view.batchNo).toBe('')
    expect(view.returnQty).toBe('0.000000')
  })
})

describe('可选字段只在有值时出现', () => {
  it('未响应、未结案时不透出那几个时间戳', async () => {
    const record = await registerTwoLine(harness)
    const view = toSalesReturnView(record, NAMING, [])
    expect(view.respondedAt).toBeUndefined()
    expect(view.closedAt).toBeUndefined()
    expect(view.rejectReason).toBeUndefined()
    expect(view.eightDNo).toBe('8D-26-0031')
  })

  it('让步的折让额与入库时间在行上按需透出', async () => {
    const record = await registerTwoLine(harness)
    const withExtras: SalesReturnRecord = {
      ...record,
      lines: [
        {
          ...record.lines[0]!,
          disposition: 'CONCESSION',
          allowanceMinor: 20_000n,
          dispositionNote: '客户降价使用',
          receivedAt: new Date('2026-07-27T10:30:00Z'),
          receivedQty: '120.000000',
          settledByCreditNote: true,
          creditNoteDocNo: 'INV-26-0900',
        },
      ],
    }
    const line = toSalesReturnView(withExtras, NAMING, []).lines[0]!
    expect(line.allowance).toBe('200.00')
    expect(line.dispositionNote).toBe('客户降价使用')
    expect(line.receivedAt).toBeDefined()
    expect(line.settledByCreditNote).toBe(true)
    expect(line.creditNoteDocNo).toBe('INV-26-0900')
  })
})

describe('RMA-01~05 时间线', () => {
  function node(overrides: Partial<TimelineNodeRecord> = {}): TimelineNodeRecord {
    return {
      id: 'T1',
      docType: 'RMA',
      docId: 'RMA1',
      node: 'RMA-01 业务登记客诉',
      ownerUserCode: 'WFX-2018-0042',
      ownerDept: '业务部',
      status: 'DONE',
      enteredAt: new Date('2026-07-26T09:20:00Z'),
      leftAt: new Date('2026-07-26T11:08:00Z'),
      durationMs: 6_480_000n,
      dueAt: null,
      remark: '2 小时首响 SLA 内完成',
      ...overrides,
    } as TimelineNodeRecord
  }

  it('没有记录的节点补成 pending，界面永远是完整的五格', () => {
    const view = toReturnTimelineView([], '罗晓琳')
    expect(view).toHaveLength(5)
    expect(view.every((item) => item.state === 'pending')).toBe(true)
    expect(view[4]!.node).toBe('RMA-05 结案与 8D 关闭')
  })

  it('耗时取平台算好的 durationMs，本模块不自己减时间戳', () => {
    const view = toReturnTimelineView([node()], '罗晓琳')
    expect(view[0]!.state).toBe('done')
    expect(view[0]!.elapsedHours).toBe(1.8)
    expect(view[0]!.remark).toBe('2 小时首响 SLA 内完成')
  })

  it('未离开的节点是 active，异常的是 overdue', () => {
    const active = toReturnTimelineView(
      [node({ leftAt: null, durationMs: null, remark: null })],
      '罗晓琳',
    )
    expect(active[0]!.state).toBe('active')
    expect(active[0]!.elapsedHours).toBeUndefined()
    expect(active[0]!.remark).toBeUndefined()

    const overdue = toReturnTimelineView([node({ status: 'ABNORMAL' })], '罗晓琳')
    expect(overdue[0]!.state).toBe('overdue')
  })

  it('没有部门时回落到工号，再没有才用兜底姓名', () => {
    const byUser = toReturnTimelineView([node({ ownerDept: null })], '罗晓琳')
    expect(byUser[0]!.owner).toBe('WFX-2018-0042')

    const byFallback = toReturnTimelineView(
      [node({ ownerDept: null, ownerUserCode: null })],
      '罗晓琳',
    )
    expect(byFallback[0]!.owner).toBe('罗晓琳')
  })
})

describe('读侧组装', () => {
  it('list / detail 都走同一支渲染，名称与时间线一并带出', async () => {
    const record = await registerTwoLine(harness)
    const detail = await harness.reads.detail(record.id)
    expect(detail.customerName).toBe('苏州明泰自动化')
    expect(detail.shipmentNo).toBe('SHP-20260702-0043')
    expect(detail.timeline).toHaveLength(5)

    const list = await harness.reads.list({})
    expect(list.map((item) => item.docNo)).toEqual([detail.docNo])
  })

  it('登记时客户、订单、币种一律从原出货单带出，前端传不进来', async () => {
    const view = await harness.reads.registerAndView(
      {
        shipmentId: 'SH1',
        reason: '阳极氧化色差',
        complaintAt: '2026-07-28T08:15:00Z',
        lines: [
          {
            sequence: 1,
            shipmentLineId: 'SL1',
            productName: '导轨压板',
            drawingNo: 'MT-7601',
            batchNo: 'B26070901',
            returnQty: '18.000000',
            unitPriceMinor: '3980',
            amountMinor: '71640',
            reason: '色差',
          },
        ],
      },
      SALES,
    )
    expect(view.status).toBe('registered')
    expect(view.amount.currency).toBe('CNY')
    expect(view.orderNo).toBe('SO-20260620-0071')
  })
})
