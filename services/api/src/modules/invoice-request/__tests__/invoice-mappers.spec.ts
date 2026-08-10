import { InvoiceContextService } from '../services/invoice-context.service'
import { InvoiceReadService } from '../services/invoice-read.service'
import { InvoiceStatementSource } from '../services/invoice-statement-source'
import { toInvoiceRequestView } from '../services/invoice-view.mapper'

import { FakeInvoiceRepository } from './fakes'
import { SALES, buildHarness, createInput, issuedInvoice } from './harness'

import type { DocTimelineService } from '../../../platform/timeline'
import type { UserDirectoryService } from '../../identity'
import type { CustomerService } from '../../masterdata'
import type { ShipmentService, StatementSourceRegistry } from '../../shipment'
import type { InvoiceRecord } from '../repositories/invoice-request.repository.port'

const NAMING = {
  customerName: '苏州明泰自动化',
  customerCode: 'C-CN-004',
  statementNo: 'STM-20260731-0012',
  ownerName: '罗晓琳',
  originalDocNo: null,
}

function record(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: 'INV1',
    docNo: 'INV-20260728-0031',
    kind: 'INVOICE',
    originalId: null,
    customerId: 'C1',
    invoiceKind: 'SPECIAL',
    statementId: 'STM1',
    currency: 'CNY',
    amountExTaxMinor: 12_424_000n,
    taxAmountMinor: 1_615_120n,
    amountIncTaxMinor: 14_039_120n,
    title: '苏州明泰自动化设备有限公司',
    taxNo: '9132050XXXXXXXXXX1J',
    bankAccount: '中国银行苏州工业园区支行',
    address: '苏州工业园区星龙街 128 号',
    deliveryMethod: '电子发票（邮箱）',
    deliveryTarget: 'finance@mingtai-auto.com',
    amountMatched: true,
    matchNote: null,
    expectedPaymentDate: new Date('2026-09-15T00:00:00Z'),
    status: 'SUBMITTED',
    ownerUserCode: 'WFX-2018-0042',
    submittedAt: new Date('2026-07-28T02:20:00Z'),
    invoiceNo: null,
    issuedAt: null,
    sentAt: null,
    signedAt: null,
    reasonText: null,
    versionLock: 0,
    lines: [
      {
        id: 'L1',
        sequence: 1,
        shipmentId: 'S1',
        shipmentNo: 'SHP-20260706-0046',
        productName: '导轨压板',
        drawingNo: 'MT-7601',
        quantity: '800.000000',
        unitPriceMinor: 3_980n,
        amountMinor: 3_184_000n,
        taxRateBps: 1_300,
        taxAmountMinor: 413_920n,
      },
    ],
    ...overrides,
  }
}

describe('对外视图对齐前端 InvoiceRequest', () => {
  it('金额转成定点字符串，税率转成小数', () => {
    const view = toInvoiceRequestView(record(), NAMING, [])

    expect(view.amountExTax).toBe('124240.00')
    expect(view.taxAmount).toBe('16151.20')
    expect(view.amountIncTax).toBe('140391.20')
    expect(view.lines[0]?.taxRate).toBe(0.13)
    expect(view.lines[0]?.unitPrice).toBe('39.80')
  })

  it('枚举翻成前端小写值', () => {
    expect(toInvoiceRequestView(record(), NAMING, []).invoiceType).toBe('special')
    expect(toInvoiceRequestView(record({ invoiceKind: 'EXPORT' }), NAMING, []).invoiceType).toBe(
      'export',
    )
    expect(toInvoiceRequestView(record({ status: 'COMPLETED' }), NAMING, []).status).toBe(
      'completed',
    )
    expect(toInvoiceRequestView(record({ status: 'VOID' }), NAMING, []).status).toBe('void')
  })

  it('预计回款日只到日', () => {
    expect(toInvoiceRequestView(record(), NAMING, []).expectedPaymentDate).toBe('2026-09-15')
  })

  it('空值字段不出现在返回体里', () => {
    const view = toInvoiceRequestView(
      record({ bankAccount: null, address: null, matchNote: null }),
      { ...NAMING, statementNo: null },
      [],
    )

    expect(view).not.toHaveProperty('bankAccount')
    expect(view).not.toHaveProperty('address')
    expect(view).not.toHaveProperty('statementNo')
    expect(view).not.toHaveProperty('invoiceNo')
  })

  it('已开票时带出发票号与开票时间', () => {
    const view = toInvoiceRequestView(
      record({ status: 'COMPLETED', invoiceNo: 'INV-26-0731', issuedAt: new Date('2026-07-29T01:00:00Z') }),
      NAMING,
      [],
    )

    expect(view.invoiceNo).toBe('INV-26-0731')
    expect(view.issuedAt).toBe('2026-07-29T01:00:00.000Z')
  })

  it('红字单在列表里就是一行负数记录，带 kind 与原票号', () => {
    const view = toInvoiceRequestView(
      record({
        kind: 'CREDIT_NOTE',
        amountIncTaxMinor: -14_039_120n,
        reasonText: '客户退货',
      }),
      { ...NAMING, originalDocNo: 'INV-20260728-0031' },
      [],
    )

    expect(view.kind).toBe('credit-note')
    expect(view.amountIncTax).toBe('-140391.20')
    expect(view.originalDocNo).toBe('INV-20260728-0031')
    expect(view.voidReason).toBe('客户退货')
  })

  it('三方不一致时把说明带出去给界面提示', () => {
    const view = toInvoiceRequestView(
      record({ amountMatched: false, matchNote: '与对账单相差 -477600' }),
      NAMING,
      [],
    )

    expect(view.amountMatched).toBe(false)
    expect(view.matchNote).toContain('477600')
  })

  it('还没提交时 submittedAt 是空串而不是 undefined', () => {
    expect(toInvoiceRequestView(record({ submittedAt: null }), NAMING, []).submittedAt).toBe('')
  })
})

describe('读侧组装', () => {
  function build(rows: InvoiceRecord[] = []): { reads: InvoiceReadService; harness: ReturnType<typeof buildHarness> } {
    const harness = buildHarness()
    rows.forEach((row) => harness.repo.rows.push(row))

    const customers = {
      invoiceProfileFor: jest.fn().mockResolvedValue({
        name: '苏州明泰自动化',
        code: 'C-CN-004',
      }),
    } as unknown as CustomerService
    const users = {
      findByUserCode: jest.fn().mockResolvedValue({ displayName: '罗晓琳' }),
    } as unknown as UserDirectoryService
    const timeline = { list: jest.fn().mockResolvedValue([]) } as unknown as DocTimelineService

    return { reads: new InvoiceReadService(harness.invoices, customers, users, timeline), harness }
  }

  it('详情把单据、抬头、业务员姓名与六格时间线拼在一起', async () => {
    const { reads, harness } = build()
    const created = await harness.invoices.create(createInput(), SALES)

    const view = await reads.detail(created.id)
    expect(view.customerCode).toBe('C-CN-004')
    expect(view.owner).toBe('罗晓琳')
  })

  it('列表逐条渲染', async () => {
    const { reads, harness } = build()
    await harness.invoices.create(createInput(), SALES)

    await expect(reads.list({ limit: 10 })).resolves.toHaveLength(1)
  })

  it('红字单渲染时带出原票号', async () => {
    const { reads, harness } = build()
    const original = await issuedInvoice(harness)
    const credit = await harness.creditNotes.create(original.id, '客户退货', null, SALES)

    const view = await reads.detail(credit.id)
    expect(view.originalDocNo).toBe(original.docNo)
  })

  it('查不到姓名时退回工号', async () => {
    const harness = buildHarness()
    const created = await harness.invoices.create(createInput(), SALES)
    const reads = new InvoiceReadService(
      harness.invoices,
      { invoiceProfileFor: jest.fn().mockResolvedValue({ name: 'X', code: 'C1' }) } as unknown as CustomerService,
      { findByUserCode: jest.fn().mockResolvedValue(null) } as unknown as UserDirectoryService,
      { list: jest.fn().mockResolvedValue([]) } as unknown as DocTimelineService,
    )

    await expect(reads.detail(created.id)).resolves.toMatchObject({ owner: 'WFX-2018-0042' })
  })
})

describe('跨模块取数只走对方公开出口', () => {
  function build(): InvoiceContextService {
    const customers = {
      invoiceProfileFor: jest.fn().mockResolvedValue({
        id: 'C1',
        code: 'C-CN-004',
        name: '苏州明泰自动化',
        region: 'DOMESTIC',
        invoiceType: 'SPECIAL',
        taxNo: 'TAX',
        bankAccount: 'BANK',
        invoiceAddress: 'ADDR',
        ownerEmail: 'a@b.c',
        paymentTerm: 'NET_60',
        currency: 'CNY',
      }),
    } as unknown as CustomerService
    const shipments = {
      load: jest.fn().mockResolvedValue({
        id: 'S1',
        docNo: 'SHP-1',
        lines: [
          {
            productName: '导轨压板',
            drawingNo: 'MT-7601',
            shippedQty: '800.000000',
            unitPriceMinor: 3_980n,
          },
        ],
      }),
    } as unknown as ShipmentService

    return new InvoiceContextService(customers, shipments)
  }

  it('客户事实按开票口径整形', async () => {
    await expect(build().customerFacts('C1')).resolves.toMatchObject({
      region: 'DOMESTIC',
      invoiceType: 'SPECIAL',
      title: '苏州明泰自动化',
    })
  })

  it.each([
    ['HK_MO_TW', 'HK_MO_TW'],
    ['OVERSEAS', 'OVERSEAS'],
  ])('%s 客户归到出口一档', async (region, expected) => {
    const customers = {
      invoiceProfileFor: jest.fn().mockResolvedValue({
        name: 'X', code: 'C', region, invoiceType: 'GENERAL', taxNo: null, bankAccount: null,
        invoiceAddress: 'A', ownerEmail: null, paymentTerm: 'NET_30', currency: 'CNY',
      }),
    } as unknown as CustomerService
    const context = new InvoiceContextService(customers, {} as unknown as ShipmentService)

    await expect(context.customerFacts('C1')).resolves.toMatchObject({ region: expected })
  })

  it('出货明细摊平成发票行，金额口径与出货一致', async () => {
    const lines = await build().linesFromShipments(['S1'])

    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ shipmentNo: 'SHP-1', amountMinor: 3_184_000n })
  })

  it('金额合计供三方比对', async () => {
    await expect(build().shipmentTotalOf(['S1'])).resolves.toBe(3_184_000n)
  })
})

describe('对账单「开票」列的真实来源', () => {
  function build(): { source: InvoiceStatementSource; repo: FakeInvoiceRepository; registry: { registerInvoiceSource: jest.Mock } } {
    const repo = new FakeInvoiceRepository()
    const registry = { registerInvoiceSource: jest.fn() }
    return {
      source: new InvoiceStatementSource(registry as unknown as StatementSourceRegistry, repo),
      repo,
      registry,
    }
  }

  it('启动时把自己注册进 registry —— 这就是替换 stub 的那一步', () => {
    const { source, registry } = build()
    source.onModuleInit()

    expect(registry.registerInvoiceSource).toHaveBeenCalledWith(source)
  })

  it('只取已开出的票，按开票日计入', async () => {
    const { source, repo } = build()
    repo.rows.push(
      record({ id: 'A', status: 'COMPLETED', issuedAt: new Date('2026-07-10'), invoiceNo: 'INV-1' }),
      record({ id: 'B', status: 'SUBMITTED' }),
    )

    const entries = await source.invoicesInPeriod('C1', new Date('2026-07-01'), new Date('2026-07-31'))
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ docNo: 'INV-1', amountMinor: 14_039_120n })
  })

  it('红字发票以负数返回，并标注是红冲', async () => {
    const { source, repo } = build()
    repo.rows.push(
      record({
        id: 'C',
        kind: 'CREDIT_NOTE',
        status: 'COMPLETED',
        issuedAt: new Date('2026-07-20'),
        invoiceNo: 'INV-1-R',
        amountIncTaxMinor: -4_000_000n,
        reasonText: '客户退货',
      }),
    )

    const entries = await source.invoicesInPeriod('C1', new Date('2026-07-01'), new Date('2026-07-31'))
    expect(entries[0]?.amountMinor).toBe(-4_000_000n)
    expect(entries[0]?.remark).toContain('红冲')
  })

  it('没有发票号时退回申请单号，对账单上总有个号可指', async () => {
    const { source, repo } = build()
    repo.rows.push(record({ status: 'COMPLETED', issuedAt: new Date('2026-07-10'), invoiceNo: null }))

    const entries = await source.invoicesInPeriod('C1', new Date('2026-07-01'), new Date('2026-07-31'))
    expect(entries[0]?.docNo).toBe('INV-20260728-0031')
  })
})
