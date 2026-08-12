import { CUSTOMS_ERRORS } from '@machining-erp/shared'

import { SalesOrderService } from '../../contract-order'
import { UserDirectoryService } from '../../identity'
import { CustomerService } from '../../masterdata'
import { ShipmentService } from '../../shipment'
import { CustomsContextService } from '../services/customs-context.service'
import { toCustomsDossierView, type CustomsNaming } from '../services/customs-view.mapper'

import { BROKER, SALES, buildHarness, createDossier } from './harness'

import type { Harness } from './harness'
import type { CustomsDossierRecord } from '../repositories/customs.repository.port'

const NAMING: CustomsNaming = {
  shipmentNo: 'SHP-1',
  orderNo: 'SO-1',
  customerName: 'Radex',
  ownerName: '陈志强',
}

let harness: Harness

beforeEach(() => {
  harness = buildHarness()
})

async function packed(): Promise<CustomsDossierRecord> {
  let current = await createDossier(harness)
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

async function declared(): Promise<CustomsDossierRecord> {
  const withDocs = await packed()
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
  return harness.declarations.declare(approved.id, approved.versionLock, BROKER)
}

/**
 * 乐观锁在每一个写端点上都要真的生效。
 * 逐个端点各测一次而不是只测一个：漏挂一处，两个人同时改就会有一个人的改动无声消失。
 */
describe('乐观锁守住每一个写端点', () => {
  it('送审', async () => {
    const record = await createDossier(harness)
    await expect(
      harness.declarations.submitForReview(record.id, record.versionLock + 9, SALES),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.NOT_EDITABLE.code })
  })

  it('复核通过', async () => {
    const record = await createDossier(harness)
    const submitted = await harness.declarations.submitForReview(
      record.id,
      record.versionLock,
      SALES,
    )
    await expect(
      harness.declarations.approveReview(submitted.id, submitted.versionLock + 9, BROKER),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.NOT_EDITABLE.code })
  })

  it('申报', async () => {
    const withDocs = await packed()
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
    await expect(
      harness.declarations.declare(approved.id, approved.versionLock + 9, BROKER),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.NOT_EDITABLE.code })
  })

  it('更正', async () => {
    const base = await declared()
    const reissued = await harness.documents.generate(
      base.id,
      base.versionLock,
      'CONTRACT',
      { posted: true, exchangeRate: '7.152000' },
      SALES,
    )
    await expect(
      harness.declarations.correct(reissued.id, reissued.versionLock + 9, '理由', BROKER),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.NOT_EDITABLE.code })
  })

  it('回执归档', async () => {
    const base = await declared()
    await expect(
      harness.declarations.archiveReceipt(base.id, base.versionLock + 9, 'CN-1', BROKER),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.NOT_EDITABLE.code })
  })

  it('退回补正', async () => {
    const record = await createDossier(harness)
    const submitted = await harness.declarations.submitForReview(
      record.id,
      record.versionLock,
      SALES,
    )
    const approved = await harness.declarations.approveReview(
      submitted.id,
      submitted.versionLock,
      BROKER,
    )
    await expect(
      harness.declarations.returnForFix(approved.id, approved.versionLock + 9, BROKER),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.NOT_EDITABLE.code })
  })
})

describe('可选入参的缺省处理', () => {
  it('建档时省略唛头与目的港代码，落成 null 而不是 undefined', async () => {
    const view = await harness.facade.createAndView(
      {
        shipmentId: 'SH1',
        tradeMode: '一般贸易',
        incoterm: 'FOB',
        portOfLoading: '深圳盐田港',
        destination: 'LA',
        hsCode: '8302410000',
        goodsNameCn: '支架',
        quantity: '1',
        unit: 'PCS',
        netWeight: '1',
        grossWeight: '1',
        packages: 1,
        unitPriceMinor: '100',
        totalAmountMinor: '100',
        exchangeRate: '7.000000',
      },
      SALES,
    )

    expect(view.shippingMarks).toBeUndefined()
    expect(view.destinationPortCode).toBeUndefined()
    expect(view.goodsNameEn).toBe('')
    // 缺项因此被如实点名，而不是因为字段是 undefined 就当作填了
    expect(view.missingFields).toEqual(
      expect.arrayContaining(['英文品名', '目的港代码', '唛头 Shipping Marks']),
    )
  })

  it('出货单没有明细行时产品名与图号回落成空串，不炸', async () => {
    const shipments = {
      load: jest.fn(async () => ({
        id: 'SH1',
        docNo: 'SHP-1',
        orderId: 'O1',
        customerId: 'C1',
        currency: 'USD',
        status: 'SHIPPED' as const,
        lines: [],
      })),
    } as unknown as ShipmentService
    const context = new CustomsContextService(
      shipments,
      { load: jest.fn(async () => ({ docNo: 'SO-1' })) } as unknown as SalesOrderService,
      { profileFor: jest.fn(async () => ({ name: 'X' })) } as unknown as CustomerService,
      { findByUserCode: jest.fn(async () => null) } as unknown as UserDirectoryService,
    )

    const result = await context.shipmentContext('SH1')
    expect(result.productName).toBe('')
    expect(result.drawingNo).toBe('')
    expect(result.quantity).toBe('0.000000')
  })
})

describe('回执视图', () => {
  it('未归档回执时不透出回执字段；归档后一并带出时间', async () => {
    const base = await declared()
    expect(toCustomsDossierView(base, NAMING).declarations![0]!.receiptNo).toBeUndefined()

    const archived = await harness.declarations.archiveReceipt(
      base.id,
      base.versionLock,
      'CN-DEC-20260728-771',
      BROKER,
    )
    const view = toCustomsDossierView(archived, NAMING).declarations![0]!
    expect(view.receiptNo).toBe('CN-DEC-20260728-771')
    expect(view.receiptAt).toBeDefined()
  })
})
