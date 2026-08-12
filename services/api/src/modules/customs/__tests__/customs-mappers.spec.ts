import { CUSTOMS_ERRORS } from '@machining-erp/shared'

import { toCustomsTimelineView } from '../services/customs-timeline.mapper'
import { toCustomsDossierView, type CustomsNaming } from '../services/customs-view.mapper'

import { BROKER, SALES, buildHarness, createDossier } from './harness'

import type { Harness } from './harness'
import type { TimelineNodeRecord } from '../../../platform/timeline'
import type { CustomsDossierRecord } from '../repositories/customs.repository.port'

const NAMING: CustomsNaming = {
  shipmentNo: 'SHP-20260727-0064',
  orderNo: 'SO-20260710-0085',
  customerName: 'Radex Instruments Inc.',
  ownerName: '陈志强',
}

let harness: Harness

beforeEach(() => {
  harness = buildHarness()
})

describe('视图映射', () => {
  it('五种文件恒定各占一格，没生成的显示「—」', async () => {
    const record = await createDossier(harness)
    const view = toCustomsDossierView(record, NAMING)

    expect(view.documents).toHaveLength(5)
    expect(view.documents.every((doc) => doc.version === '—')).toBe(true)
    expect(view.documents.map((doc) => doc.templateCode)).toEqual([
      'EXP-PIN',
      'EXP-INV',
      'EXP-PKL',
      'EXP-CON',
      'EXP-DEC',
    ])
  })

  it('生成后显示 V1 并带出版本号、汇率快照与文件 id', async () => {
    const record = await createDossier(harness)
    const generated = await harness.documents.generate(
      record.id,
      record.versionLock,
      'CONTRACT',
      { posted: true, exchangeRate: '7.152000' },
      SALES,
    )
    const contract = toCustomsDossierView(generated, NAMING).documents.find(
      (doc) => doc.templateCode === 'EXP-CON',
    )!

    expect(contract.version).toBe('V1')
    expect(contract.versionNo).toBe(1)
    expect(contract.exchangeRate).toBe('7.152000')
    expect(contract.documentId).toBeDefined()
  })

  it('版本已登记但文件还没出来时标 pending——前端据此禁用下载与预览', async () => {
    const record = await createDossier(harness)
    const generated = await harness.documents.generate(
      record.id,
      record.versionLock,
      'CONTRACT',
      { posted: true, exchangeRate: '7.152000' },
      SALES,
    )
    const contract = toCustomsDossierView(generated, NAMING).documents.find(
      (doc) => doc.templateCode === 'EXP-CON',
    )!
    expect(contract.pending).toBe(true)
  })

  it('docgen 真出了文件就不再是 pending', async () => {
    harness.renderer.produceFiles = true
    const record = await createDossier(harness)
    const generated = await harness.documents.generate(
      record.id,
      record.versionLock,
      'CONTRACT',
      { posted: true, exchangeRate: '7.152000' },
      SALES,
    )
    const contract = toCustomsDossierView(generated, NAMING).documents.find(
      (doc) => doc.templateCode === 'EXP-CON',
    )!
    expect(contract.pending).toBeUndefined()
  })

  it('多版时表头只显示最新一版', async () => {
    const record = await createDossier(harness)
    const first = await harness.documents.generate(
      record.id,
      record.versionLock,
      'CONTRACT',
      { posted: true, exchangeRate: '7.152000' },
      SALES,
    )
    const second = await harness.documents.generate(
      first.id,
      first.versionLock,
      'CONTRACT',
      { posted: true, exchangeRate: '7.300000' },
      SALES,
    )
    const contract = toCustomsDossierView(second, NAMING).documents.find(
      (doc) => doc.templateCode === 'EXP-CON',
    )!
    expect(contract.version).toBe('V2')
    expect(contract.exchangeRate).toBe('7.300000')
  })

  it('missingFields 现算不落库：改了要素立刻反映，不会挂着一条已经补上的缺项', async () => {
    const record = await createDossier(harness, { shippingMarks: null })
    expect(toCustomsDossierView(record, NAMING).missingFields).toEqual(['唛头 Shipping Marks'])

    const fixed: CustomsDossierRecord = { ...record, shippingMarks: 'MARKS/2026' }
    expect(toCustomsDossierView(fixed, NAMING).missingFields).toEqual([])
  })

  it('金额按最小单位转成前端的字符串形状', async () => {
    const record = await createDossier(harness)
    const view = toCustomsDossierView(record, NAMING)
    expect(view.totalAmount).toEqual({ amount: '37001.40', currency: 'USD' })
    expect(view.unitPrice).toBe('24.90')
    expect(view.packages).toBe('12')
  })

  it('可选字段只在有值时出现', async () => {
    const record = await createDossier(harness)
    const view = toCustomsDossierView(record, NAMING)
    expect(view.checkedBy).toBeUndefined()
    expect(view.declarationVersion).toBeUndefined()
    expect(view.declarations).toBeUndefined()
    expect(view.corrections).toBeUndefined()
    expect(view.shippingMarks).toBe('RADEX/LA/2026-07/NO.1-12')
  })

  it('英文品名缺失时给空串而不是 undefined——前端那一栏直接渲染', async () => {
    const record = await createDossier(harness, { goodsNameEn: null })
    expect(toCustomsDossierView(record, NAMING).goodsNameEn).toBe('')
  })

  it('申报与更正记录透出，更正带中文理由', async () => {
    const record = await createDossier(harness)
    const withDocs = await generateAll(record)
    const submitted = await harness.declarations.submitForReview(
      withDocs.id,
      withDocs.versionLock,
      SALES,
    )
    const approved = await harness.declarations.approveReview(
      submitted.id,
      submitted.versionLock,
      BROKER,
    )
    const declared = await harness.declarations.declare(
      approved.id,
      approved.versionLock,
      BROKER,
    )
    const reissued = await harness.documents.generate(
      declared.id,
      declared.versionLock,
      'CONTRACT',
      { posted: true, exchangeRate: '7.152000' },
      SALES,
    )
    const corrected = await harness.declarations.correct(
      reissued.id,
      reissued.versionLock,
      '合同条款更新',
      BROKER,
    )

    const view = toCustomsDossierView(corrected, NAMING)
    expect(view.declarationVersion).toBe(2)
    expect(view.declarations).toHaveLength(2)
    expect(view.corrections![0]!.reason).toBe('合同条款更新')
    expect(view.corrections![0]!.affectedDocuments[0]).toMatchObject({
      templateCode: 'EXP-CON',
      fromVersion: 1,
      toVersion: 2,
    })
  })

  async function generateAll(record: CustomsDossierRecord) {
    let current = record
    for (const kind of ['COMMERCIAL_INVOICE', 'PACKING_LIST', 'CONTRACT'] as const) {
      current = await harness.documents.generate(
        current.id,
        current.versionLock,
        kind,
        { posted: true, exchangeRate: '7.152000' },
        SALES,
      )
    }
    return current
  }
})

describe('EXP-01~04 时间线', () => {
  function node(overrides: Partial<TimelineNodeRecord> = {}): TimelineNodeRecord {
    return {
      id: 'T1',
      docType: 'EXP',
      docId: 'CD1',
      node: 'EXP-01 业务建档报关要素',
      ownerUserCode: 'WFX-2018-0042',
      ownerDept: '业务部',
      status: 'DONE',
      enteredAt: new Date('2026-07-27T09:00:00Z'),
      leftAt: new Date('2026-07-27T10:48:00Z'),
      durationMs: 6_480_000n,
      dueAt: null,
      remark: null,
      ...overrides,
    } as TimelineNodeRecord
  }

  it('四格恒定；没记录的补成 pending——复核没进过一眼看得出', () => {
    const view = toCustomsTimelineView([], '陈志强')
    expect(view).toHaveLength(4)
    expect(view[1]!.node).toBe('EXP-02 关务复核要素')
    expect(view.every((item) => item.state === 'pending')).toBe(true)
  })

  it('耗时取平台算好的 durationMs', () => {
    const view = toCustomsTimelineView([node()], '陈志强')
    expect(view[0]!.state).toBe('done')
    expect(view[0]!.elapsedHours).toBe(1.8)
  })
})

describe('读侧组装', () => {
  it('list 与 detail 走同一支渲染，跨模块名称一并带出', async () => {
    const record = await createDossier(harness)
    const detail = await harness.reads.detail(record.id)
    expect(detail.customerName).toBe('Radex Instruments Inc.')
    expect(detail.shipmentNo).toBe('SHP-20260727-0064')
    expect(detail.orderNo).toBe('SO-20260710-0085')

    const list = await harness.reads.list({})
    expect(list.map((item) => item.docNo)).toEqual([detail.docNo])
  })

  it('查不到就是 NOT_FOUND', async () => {
    await expect(harness.customs.load('nope')).rejects.toMatchObject({
      code: CUSTOMS_ERRORS.NOT_FOUND.code,
    })
  })

  it('facade 建档时客户、订单、币种一律从出货单带出', async () => {
    const view = await harness.facade.createAndView(
      {
        shipmentId: 'SH1',
        tradeMode: '一般贸易',
        incoterm: 'CIF 汉堡',
        portOfLoading: '深圳蛇口港',
        destination: 'Hamburg, Germany',
        destinationPortCode: 'DEHAM',
        shippingMarks: 'BRENNER/HAM/NO.1-20',
        hsCode: '8481909000',
        goodsNameCn: '不锈钢液压阀体',
        goodsNameEn: 'Stainless Steel Hydraulic Valve Body',
        quantity: '1000.000000',
        unit: 'PCS',
        netWeight: '860.000',
        grossWeight: '944.000',
        packages: 20,
        unitPriceMinor: '11850',
        totalAmountMinor: '11850000',
        exchangeRate: '7.834000',
      },
      SALES,
    )

    expect(view.status).toBe('draft')
    expect(view.totalAmount.currency).toBe('USD')
    expect(view.missingFields).toEqual([])
  })

  it('facade 出具文件时不传汇率就沿用建档汇率', async () => {
    const record = await createDossier(harness)
    const view = await harness.facade.generateAndView(
      record.id,
      { versionLock: record.versionLock, kind: 'CONTRACT' },
      SALES,
    )
    const contract = view.documents.find((doc) => doc.templateCode === 'EXP-CON')!
    expect(contract.exchangeRate).toBe('7.152000')
  })
})
