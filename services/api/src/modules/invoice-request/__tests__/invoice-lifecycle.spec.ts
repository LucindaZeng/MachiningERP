import { assertDeliveryOrder } from '../services/invoice-issuance.service'

import { FINANCE, OUTSIDER, SALES, buildHarness, createInput, issuedInvoice } from './harness'

import type { Harness } from './harness'
import type { InvoiceRecord } from '../repositories/invoice-request.repository.port'

describe('建单：一切自动带出', () => {
  it('取号、落草稿、金额与税额按客户档案算好', async () => {
    const harness = buildHarness()
    const record = await harness.invoices.create(createInput(), SALES)

    expect(record.docNo).toMatch(/^INV-/)
    expect(record.status).toBe('DRAFT')
    expect(record.invoiceKind).toBe('SPECIAL')
    expect(record.amountExTaxMinor).toBe(12_424_000n)
    expect(record.taxAmountMinor).toBe(1_615_120n)
    expect(record.amountIncTaxMinor).toBe(14_039_120n)
  })

  it('抬头税号地址冻结在申请上，不随客户档案后续变动', async () => {
    const harness = buildHarness()
    const record = await harness.invoices.create(createInput(), SALES)

    expect(record.title).toBe('苏州明泰自动化设备有限公司')
    expect(record.taxNo).toBe('9132050XXXXXXXXXX1J')
  })

  it('开 INV-01 节点并留痕', async () => {
    const harness = buildHarness()
    await harness.invoices.create(createInput(), SALES)

    expect(harness.timelineEnter).toHaveBeenCalledWith(
      expect.objectContaining({ node: 'INV-01 业务提交发票申请' }),
    )
    expect(harness.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'invoice-request.create' }),
    )
  })

  it('没有出货单不能建单', async () => {
    const harness = buildHarness()
    await expect(
      harness.invoices.create({ ...createInput(), shipmentIds: [] }, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2704' })
  })

  it('非业务岗位不能建单', async () => {
    const harness = buildHarness()
    await expect(harness.invoices.create(createInput(), OUTSIDER)).rejects.toMatchObject({
      code: 'ORD_2702',
    })
  })

  it('对账金额对不上时照样建得出来，标记为不一致', async () => {
    const harness = buildHarness()
    const record = await harness.invoices.create(createInput(11_000_000n), SALES)

    expect(record.amountMatched).toBe(false)
    expect(record.matchNote).toContain('与对账单相差')
  })

  it('不关联对账单时只比出货，一致', async () => {
    const harness = buildHarness()
    const record = await harness.invoices.create(createInput(null), SALES)
    expect(record.amountMatched).toBe(true)
  })
})

describe('状态推进：COMPLETED 在开票那一刻就到', () => {
  it('草稿 → 待复核 → 财务开票中 → 已开票交付', async () => {
    const harness = buildHarness()
    const created = await harness.invoices.create(createInput(), SALES)
    const submitted = await harness.invoices.submit(created.id, created.versionLock, SALES)
    expect(submitted.status).toBe('SUBMITTED')

    const reviewing = await harness.issuance.sendToFinance(
      submitted.id,
      submitted.versionLock,
      SALES,
    )
    expect(reviewing.status).toBe('REVIEWING')

    const issued = await harness.issuance.issue(
      reviewing.id,
      reviewing.versionLock,
      'INV-26-0731',
      FINANCE,
    )
    expect(issued.status).toBe('COMPLETED')
    expect(issued.invoiceNo).toBe('INV-26-0731')
    expect(issued.issuedAt).toBeInstanceOf(Date)
  })

  it('开票即 COMPLETED——不等寄出、不等签收', async () => {
    const harness = buildHarness()
    const issued = await issuedInvoice(harness)

    expect(issued.status).toBe('COMPLETED')
    expect(issued.sentAt).toBeNull()
    expect(issued.signedAt).toBeNull()
  })

  it('三方金额对不上时送不进财务，拦在开票之前', async () => {
    const harness = buildHarness()
    const created = await harness.invoices.create(createInput(11_000_000n), SALES)
    const submitted = await harness.invoices.submit(created.id, created.versionLock, SALES)

    await expect(
      harness.issuance.sendToFinance(submitted.id, submitted.versionLock, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2705' })
    expect(harness.submitForIssuance).not.toHaveBeenCalled()
  })

  it('开票必须回填发票号', async () => {
    const harness = buildHarness()
    const created = await harness.invoices.create(createInput(), SALES)
    const submitted = await harness.invoices.submit(created.id, created.versionLock, SALES)
    const reviewing = await harness.issuance.sendToFinance(submitted.id, submitted.versionLock, SALES)

    await expect(
      harness.issuance.issue(reviewing.id, reviewing.versionLock, '   ', FINANCE),
    ).rejects.toMatchObject({ code: 'ORD_2706' })
  })

  it('开票是财务的动作，业务岗位做不了', async () => {
    const harness = buildHarness()
    const created = await harness.invoices.create(createInput(), SALES)
    const submitted = await harness.invoices.submit(created.id, created.versionLock, SALES)
    const reviewing = await harness.issuance.sendToFinance(submitted.id, submitted.versionLock, SALES)

    await expect(
      harness.issuance.issue(reviewing.id, reviewing.versionLock, 'INV-1', SALES),
    ).rejects.toMatchObject({ code: 'ORD_2703' })
  })

  it('跳过复核直接开票被状态机挡下', async () => {
    const harness = buildHarness()
    const created = await harness.invoices.create(createInput(), SALES)

    await expect(
      harness.issuance.issue(created.id, created.versionLock, 'INV-1', FINANCE),
    ).rejects.toMatchObject({ code: 'SYS_9012' })
  })

  it('版本冲突报 ORD_2701', async () => {
    const harness = buildHarness()
    const created = await harness.invoices.create(createInput(), SALES)

    await expect(
      harness.invoices.submit(created.id, created.versionLock + 5, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2701' })
  })

  it('开票后发 sales.invoice.issued，金额为正', async () => {
    const harness = buildHarness()
    await issuedInvoice(harness)

    expect(harness.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'sales.invoice.issued',
        payload: expect.objectContaining({
          kind: 'INVOICE',
          amountIncTaxMinor: '14039120',
          invoiceNo: 'INV-26-0731',
        }),
      }),
    )
  })

  it('开票后通知业务员', async () => {
    const harness = buildHarness()
    await issuedInvoice(harness)

    expect(harness.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('发票已开出') }),
    )
  })
})

describe('寄出与签收是时间线事件，不是状态', () => {
  async function issued(harness: Harness): Promise<InvoiceRecord> {
    return issuedInvoice(harness)
  }

  it('寄出后状态仍是 COMPLETED，只多一个时间戳', async () => {
    const harness = buildHarness()
    const record = await issued(harness)
    const sent = await harness.issuance.markSent(record.id, record.versionLock, SALES)

    expect(sent.status).toBe('COMPLETED')
    expect(sent.sentAt).toBeInstanceOf(Date)
  })

  it('签收必须先寄出', async () => {
    const harness = buildHarness()
    const record = await issued(harness)

    await expect(
      harness.issuance.markSigned(record.id, record.versionLock, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2711' })
  })

  it('寄出只能记一次', async () => {
    const harness = buildHarness()
    const record = await issued(harness)
    const sent = await harness.issuance.markSent(record.id, record.versionLock, SALES)

    await expect(
      harness.issuance.markSent(sent.id, sent.versionLock, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2711' })
  })

  it('寄出 → 签收走通，签收时关闭时间线', async () => {
    const harness = buildHarness()
    const record = await issued(harness)
    const sent = await harness.issuance.markSent(record.id, record.versionLock, SALES)
    const signed = await harness.issuance.markSigned(sent.id, sent.versionLock, SALES)

    expect(signed.signedAt).toBeInstanceOf(Date)
    expect(harness.timelineClose).toHaveBeenCalled()
  })

  it('签收也只能记一次', async () => {
    const harness = buildHarness()
    const record = await issued(harness)
    const sent = await harness.issuance.markSent(record.id, record.versionLock, SALES)
    const signed = await harness.issuance.markSigned(sent.id, sent.versionLock, SALES)

    await expect(
      harness.issuance.markSigned(signed.id, signed.versionLock, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2711' })
  })

  it('没开票不能记寄出', async () => {
    const harness = buildHarness()
    const created = await harness.invoices.create(createInput(), SALES)

    await expect(
      harness.issuance.markSent(created.id, created.versionLock, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2712' })
  })

  it('顺序规则本身是纯函数，四种组合都判得对', () => {
    const base = { sentAt: null, signedAt: null } as InvoiceRecord

    expect(() => assertDeliveryOrder(base, 'SENT')).not.toThrow()
    expect(() => assertDeliveryOrder(base, 'SIGNED')).toThrow()
    expect(() => assertDeliveryOrder({ ...base, sentAt: new Date() }, 'SENT')).toThrow()
    expect(() => assertDeliveryOrder({ ...base, sentAt: new Date() }, 'SIGNED')).not.toThrow()
  })
})

describe('作废：只在开票之前', () => {
  it('待复核的申请可以作废，理由必填', async () => {
    const harness = buildHarness()
    const created = await harness.invoices.create(createInput(), SALES)
    const submitted = await harness.invoices.submit(created.id, created.versionLock, SALES)

    const voided = await harness.issuance.void(
      submitted.id,
      submitted.versionLock,
      '客户撤单',
      SALES,
    )
    expect(voided.status).toBe('VOID')
    expect(voided.reasonText).toBe('客户撤单')
  })

  it('没写理由不许作废', async () => {
    const harness = buildHarness()
    const created = await harness.invoices.create(createInput(), SALES)

    await expect(
      harness.issuance.void(created.id, created.versionLock, '   ', SALES),
    ).rejects.toMatchObject({ code: 'ORD_2707' })
  })

  it('已开票的不能作废，只能红冲', async () => {
    const harness = buildHarness()
    const record = await issuedInvoice(harness)

    await expect(
      harness.issuance.void(record.id, record.versionLock, '开错了', SALES),
    ).rejects.toMatchObject({ code: 'ORD_2708' })
  })
})

describe('红冲：新开一张负数发票，原票不动', () => {
  it('全额红冲的金额与原票等大反号', async () => {
    const harness = buildHarness()
    const original = await issuedInvoice(harness)
    const credit = await harness.creditNotes.create(original.id, '客户退货', null, SALES)

    expect(credit.kind).toBe('CREDIT_NOTE')
    expect(credit.originalId).toBe(original.id)
    expect(credit.amountIncTaxMinor).toBe(-original.amountIncTaxMinor)
    expect(credit.lines.every((line) => line.amountMinor <= 0n)).toBe(true)
  })

  it('原票一个字都没被改', async () => {
    const harness = buildHarness()
    const original = await issuedInvoice(harness)
    await harness.creditNotes.create(original.id, '客户退货', null, SALES)

    const reloaded = await harness.invoices.load(original.id)
    expect(reloaded.status).toBe('COMPLETED')
    expect(reloaded.amountIncTaxMinor).toBe(14_039_120n)
  })

  it('没开票的申请谈不上红冲', async () => {
    const harness = buildHarness()
    const created = await harness.invoices.create(createInput(), SALES)

    await expect(
      harness.creditNotes.create(created.id, '开错了', null, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2709' })
  })

  it('理由必填', async () => {
    const harness = buildHarness()
    const original = await issuedInvoice(harness)

    await expect(
      harness.creditNotes.create(original.id, '  ', null, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2707' })
  })

  it('部分红冲按比例摊到各行', async () => {
    const harness = buildHarness()
    const original = await issuedInvoice(harness)
    const credit = await harness.creditNotes.create(original.id, '部分退货', 7_019_560n, SALES)

    expect(credit.amountIncTaxMinor).toBe(-7_019_560n)
    // 一半金额 → 各行也大致减半
    expect(credit.lines[0]?.amountMinor).toBe(-1_592_000n)
  })

  it('累计红冲超过原票时拒绝，并告知还能冲多少', async () => {
    const harness = buildHarness()
    const original = await issuedInvoice(harness)

    await expect(
      harness.creditNotes.create(original.id, '冲太多', 20_000_000n, SALES),
    ).rejects.toMatchObject({
      code: 'ORD_2710',
      details: expect.objectContaining({ remainingMinor: '14039120' }),
    })
  })

  it('已开出的红字单占用额度，第二张只能冲剩下的', async () => {
    const harness = buildHarness()
    const original = await issuedInvoice(harness)

    const first = await harness.creditNotes.create(original.id, '第一次', 10_000_000n, SALES)
    const submitted = await harness.invoices.submit(first.id, first.versionLock, SALES)
    const reviewing = await harness.issuance.sendToFinance(
      submitted.id,
      submitted.versionLock,
      SALES,
    )
    await harness.issuance.issue(reviewing.id, reviewing.versionLock, 'INV-26-0731-R1', FINANCE)

    await expect(
      harness.creditNotes.create(original.id, '第二次', 5_000_000n, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2710' })

    await expect(
      harness.creditNotes.create(original.id, '第二次', 4_039_120n, SALES),
    ).resolves.toBeDefined()
  })

  it('红字单走与正票一样的状态机，开出后事件金额为负', async () => {
    const harness = buildHarness()
    const original = await issuedInvoice(harness)
    const credit = await harness.creditNotes.create(original.id, '客户退货', null, SALES)

    const submitted = await harness.invoices.submit(credit.id, credit.versionLock, SALES)
    const reviewing = await harness.issuance.sendToFinance(
      submitted.id,
      submitted.versionLock,
      SALES,
    )
    await harness.issuance.issue(reviewing.id, reviewing.versionLock, 'INV-26-0731-R', FINANCE)

    expect(harness.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          kind: 'CREDIT_NOTE',
          amountIncTaxMinor: '-14039120',
        }),
      }),
    )
  })
})
