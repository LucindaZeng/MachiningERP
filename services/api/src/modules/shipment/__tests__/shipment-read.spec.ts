import { DocTimelineService } from '../../../platform/timeline'
import { ShipmentContextService } from '../services/shipment-context.service'
import { toShipmentHeaderDraft, toShipmentLineDrafts } from '../services/shipment-input.mapper'
import { ShipmentPostingService } from '../services/shipment-posting.service'
import { ShipmentReadService } from '../services/shipment-read.service'
import { buildResolutions } from '../services/shipment-tail.service'
import { StatementReadService } from '../services/statement-read.service'

import { ORDER_LINES, SALES, buildHarness, draftHeader, draftLines } from './harness'

import type { DomainEventPublisher } from '../../../platform/events'
import type { SalesOrderService } from '../../contract-order'
import type { UserDirectoryService } from '../../identity'
import type { CustomerService } from '../../masterdata'
import type { CreateShipmentDto } from '../dto/create-shipment.dto'
import type { ShipmentRepositoryPort } from '../repositories/shipment.repository.port'

describe('入参映射：数量统一成定点字符串，金额保持整数最小单位', () => {
  const dto: CreateShipmentDto = {
    orderId: 'O1',
    customerId: 'C1',
    lines: [
      {
        sequence: 1,
        orderLineId: 'OL1',
        productName: '探头支架',
        drawingNo: 'RX-3390',
        batchNo: 'B26071502',
        orderedQty: '1500',
        qualifiedQty: '1486',
        packedQty: '1486',
        shippedQty: '1486',
        unitPriceMinor: '2490',
      },
    ],
  }

  it('缺省币种落 CNY，可选字段落 null', () => {
    const header = toShipmentHeaderDraft(dto, 'WFX-2018-0042')

    expect(header).toMatchObject({
      currency: 'CNY',
      carrier: null,
      trackingNo: null,
      deliveryAddressId: null,
      ownerUserCode: 'WFX-2018-0042',
    })
  })

  it('显式传的币种与承运商照用', () => {
    const header = toShipmentHeaderDraft(
      { ...dto, currency: 'USD', carrier: 'DHL', trackingNo: 'X1', deliveryAddressId: 'ADDR1' },
      'WFX-2018-0042',
    )

    expect(header).toMatchObject({ currency: 'USD', carrier: 'DHL', deliveryAddressId: 'ADDR1' })
  })

  it('整数数量补齐到 6 位小数，单价转成 bigint', () => {
    const [line] = toShipmentLineDrafts(dto)

    expect(line?.orderedQty).toBe('1500.000000')
    expect(line?.unitPriceMinor).toBe(2_490n)
    expect(line?.itemCode).toBeNull()
  })
})

describe('跨模块取数的唯一入口', () => {
  function build(): ShipmentContextService {
    const orders = {
      load: jest.fn().mockResolvedValue({
        id: 'O1',
        docNo: 'SO-20260710-0085',
        currency: 'USD',
        lines: [{ id: 'OL1', quantity: '1500.000000', unitPriceMinor: 2_490n }],
      }),
    } as unknown as SalesOrderService
    const customers = {
      profileFor: jest.fn().mockResolvedValue({
        id: 'C1',
        code: 'C-US-007',
        name: 'Radex Instruments Inc.',
        shortName: 'Radex',
        paymentTerm: 'CASH_BEFORE_SHIPMENT',
        currency: 'USD',
        salesUserCode: 'WFX-2018-0042',
      }),
    } as unknown as CustomerService
    const users = {
      findByUserCode: jest.fn(async (code: string) =>
        code === 'WFX-2018-0042' ? { displayName: '陈志强' } : null,
      ),
    } as unknown as UserDirectoryService

    return new ShipmentContextService(orders, customers, users)
  }

  it('订单事实只取出货要用的三个字段', async () => {
    const context = await build().orderContext('O1')

    expect(context.orderNo).toBe('SO-20260710-0085')
    expect(context.lines).toEqual([
      { orderLineId: 'OL1', orderedQty: '1500.000000', unitPriceMinor: 2_490n },
    ])
  })

  it('客户画像带出付款条件与币种，不带敏感字段', async () => {
    const customer = await build().customerContext('C1')

    expect(customer).toEqual({
      customerCode: 'C-US-007',
      customerName: 'Radex Instruments Inc.',
      paymentTerm: 'CASH_BEFORE_SHIPMENT',
      currency: 'USD',
    })
  })

  it('查得到姓名就用姓名', async () => {
    await expect(build().displayName('WFX-2018-0042')).resolves.toBe('陈志强')
  })

  it('查不到姓名时退回工号——宁可显示工号也不要空白', async () => {
    await expect(build().displayName('WFX-9999-9999')).resolves.toBe('WFX-9999-9999')
  })

  it('namingFor 一次并发取齐三个名字', async () => {
    await expect(build().namingFor('O1', 'C1', 'WFX-2018-0042')).resolves.toEqual({
      orderNo: 'SO-20260710-0085',
      customerName: 'Radex Instruments Inc.',
      ownerName: '陈志强',
    })
  })
})

describe('读侧组装', () => {
  function readService(harness: ReturnType<typeof buildHarness>): ShipmentReadService {
    const context = {
      orderContext: jest.fn().mockResolvedValue({
        orderId: 'O1',
        orderNo: 'SO-20260710-0085',
        currency: 'CNY',
        lines: ORDER_LINES,
      }),
      namingFor: jest.fn().mockResolvedValue({
        orderNo: 'SO-20260710-0085',
        customerName: 'Radex Instruments Inc.',
        ownerName: '陈志强',
      }),
    } as unknown as ShipmentContextService
    const timeline = { list: jest.fn().mockResolvedValue([]) } as unknown as DocTimelineService

    return new ShipmentReadService(harness.shipments, context, timeline)
  }

  it('详情把记录、名称与六格时间线拼在一起', async () => {
    const harness = buildHarness()
    const record = await harness.shipments.create(draftHeader(), draftLines(), ORDER_LINES, SALES)
    const view = await readService(harness).detail(record.id)

    expect(view.orderNo).toBe('SO-20260710-0085')
    expect(view.timeline).toHaveLength(6)
    expect(view.lines).toHaveLength(2)
  })

  it('列表逐条渲染', async () => {
    const harness = buildHarness()
    await harness.shipments.create(draftHeader(), draftLines(), ORDER_LINES, SALES)
    const views = await readService(harness).list({ limit: 10 })

    expect(views).toHaveLength(1)
  })

  it('建单后立刻返回渲染好的视图', async () => {
    const harness = buildHarness()
    const view = await readService(harness).createAndView(
      {
        orderId: 'O1',
        customerId: 'C1',
        lines: draftLines().map((line) => ({
          ...line,
          itemCode: line.itemCode,
          unitPriceMinor: line.unitPriceMinor.toString(),
        })),
      },
      SALES,
    )

    expect(view.status).toBe('planned')
    expect(view.docNo).toMatch(/^SHP-/)
  })

  it('对账单读侧带出客户抬头与业务员姓名', async () => {
    const harness = buildHarness()
    const context = {
      customerContext: jest.fn().mockResolvedValue({
        customerCode: 'C-CN-004',
        customerName: '苏州明泰自动化',
        paymentTerm: 'NET_60',
        currency: 'CNY',
      }),
      displayName: jest.fn().mockResolvedValue('罗晓琳'),
    } as unknown as ShipmentContextService
    const reads = new StatementReadService(harness.statements, context)

    const record = await harness.statements.generate(
      {
        customerId: 'C1',
        periodFrom: new Date('2026-07-01T00:00:00Z'),
        periodTo: new Date('2026-07-31T00:00:00Z'),
        basis: 'SHIPMENT',
        customerClosingMinor: null,
      },
      SALES,
    )

    await expect(reads.detail(record.id)).resolves.toMatchObject({
      customerCode: 'C-CN-004',
      owner: '罗晓琳',
    })
    await expect(reads.list({ limit: 10 })).resolves.toHaveLength(1)
  })
})

describe('尾数与过账的边界分支', () => {
  it('已经结清的行不再重复处置', async () => {
    const harness = buildHarness()
    const record = await harness.shipments.create(draftHeader(), draftLines(), ORDER_LINES, SALES)
    const resolved = {
      ...record,
      lines: record.lines.map((line) => ({ ...line, tailResolvedQty: line.orderedQty })),
    }

    expect(buildResolutions(resolved, 'SCRAP', null, SALES.userCode)).toEqual([])
  })

  it('返工事件里找不到对应行时字段落 null 而不是崩掉', async () => {
    const harness = buildHarness()
    const publish = jest.fn().mockResolvedValue(undefined)
    const events = { publish } as unknown as DomainEventPublisher
    const posting = new ShipmentPostingService(events, harness.repo as ShipmentRepositoryPort)
    const record = await harness.shipments.create(draftHeader(), draftLines(), ORDER_LINES, SALES)

    // 尚未出运：shippedAt 为 null，payload 里该是 null 而不是 undefined
    await posting.publishPosted(record, ORDER_LINES)
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ shippedAt: null }) }),
    )
  })

  it('签收事件在 signedAt 还没落时也发得出去', async () => {
    const harness = buildHarness()
    const publish = jest.fn().mockResolvedValue(undefined)
    const posting = new ShipmentPostingService(
      { publish } as unknown as DomainEventPublisher,
      harness.repo as ShipmentRepositoryPort,
    )
    const record = await harness.shipments.create(draftHeader(), draftLines(), ORDER_LINES, SALES)

    await posting.publishSigned(record)
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ signedAt: null }) }),
    )
  })
})
