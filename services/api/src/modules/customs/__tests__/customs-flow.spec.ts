import { CUSTOMS_ERRORS } from '@machining-erp/shared'

import { BROKER, OUTSIDER, SALES, buildHarness, createDossier } from './harness'

import type { Harness } from './harness'
import type { CustomsDossierRecord } from '../repositories/customs.repository.port'

let harness: Harness

beforeEach(() => {
  harness = buildHarness()
})

/** 出齐数据包必需的三份文件，停在「已生成」之前。 */
async function generatePackDocuments(record: CustomsDossierRecord): Promise<CustomsDossierRecord> {
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

/** 一路推到「已申报」。 */
async function toDeclared(record: CustomsDossierRecord): Promise<CustomsDossierRecord> {
  const withDocs = await generatePackDocuments(record)
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

describe('EXP-01 建档', () => {
  it('建档落在草稿，编号走 EXP 前缀', async () => {
    const record = await createDossier(harness)
    expect(record.status).toBe('DRAFT')
    expect(record.docNo).toMatch(/^EXP-/u)
    expect(harness.timelineEnter).toHaveBeenCalledWith(
      expect.objectContaining({ node: 'EXP-01 业务建档报关要素' }),
    )
  })

  it('没有业务权限建不了档', async () => {
    await expect(createDossierAs(OUTSIDER)).rejects.toMatchObject({
      code: CUSTOMS_ERRORS.SALES_ROLE_REQUIRED.code,
    })
  })

  function createDossierAs(actor: typeof OUTSIDER) {
    return harness.customs.create(
      {
        shipmentId: 'SH1',
        orderId: 'O1',
        customerId: 'C1',
        tradeMode: '一般贸易',
        incoterm: 'FOB',
        portOfLoading: '深圳盐田港',
        destination: 'LA',
        destinationPortCode: 'USLAX',
        shippingMarks: 'M',
        hsCode: '8302410000',
        goodsNameCn: '支架',
        goodsNameEn: 'Bracket',
        quantity: '1',
        unit: 'PCS',
        netWeight: '1',
        grossWeight: '1',
        packages: 1,
        currency: 'USD',
        unitPriceMinor: 100n,
        totalAmountMinor: 100n,
        exchangeRate: '7.000000',
        ownerUserCode: actor.userCode,
      },
      actor,
    )
  }
})

describe('EXP-03 出具文件：要素闸门与发货前置', () => {
  it('要素缺项时拒绝生成，并一次列全缺了什么', async () => {
    const record = await createDossier(harness, { shippingMarks: null, destinationPortCode: null })
    await expect(
      harness.documents.generate(
        record.id,
        record.versionLock,
        'PACKING_LIST',
        { posted: true, exchangeRate: '7.152000' },
        SALES,
      ),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.FIELDS_INCOMPLETE.code })
  })

  it('缺项详情里带的是中文标签，业务员照着补就行', async () => {
    const record = await createDossier(harness, { shippingMarks: null })
    try {
      await harness.documents.generate(
        record.id,
        record.versionLock,
        'PACKING_LIST',
        { posted: true, exchangeRate: '7.152000' },
        SALES,
      )
      throw new Error('应当抛错')
    } catch (error) {
      const details = (error as { details?: { missingFields?: string[] } }).details
      expect(details?.missingFields).toEqual(['唛头 Shipping Marks'])
    }
  })

  it('未过账时商业发票开不出来——没有实发数就只能填订单数', async () => {
    const record = await createDossier(harness)
    await expect(
      harness.documents.generate(
        record.id,
        record.versionLock,
        'COMMERCIAL_INVOICE',
        { posted: false, exchangeRate: '7.152000' },
        SALES,
      ),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.SHIPMENT_NOT_POSTED.code })
  })

  it('形式发票不受发货前置限制——它的用途就是出货前开信用证收预付款', async () => {
    const record = await createDossier(harness)
    const generated = await harness.documents.generate(
      record.id,
      record.versionLock,
      'PROFORMA_INVOICE',
      { posted: false, exchangeRate: '7.152000' },
      SALES,
    )
    expect(generated.documents).toHaveLength(1)
    expect(generated.documents[0]!.kind).toBe('PROFORMA_INVOICE')
  })

  it('数据包缺必需件时拒绝生成', async () => {
    const record = await createDossier(harness)
    await expect(
      harness.documents.generate(
        record.id,
        record.versionLock,
        'DATA_PACK',
        { posted: true, exchangeRate: '7.152000' },
        SALES,
      ),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.DATA_PACK_INCOMPLETE.code })
  })

  it('生成永远是追加：重出一次得到 V2，V1 原样留着', async () => {
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
      { posted: true, exchangeRate: '7.210000' },
      SALES,
    )

    const contracts = second.documents.filter((doc) => doc.kind === 'CONTRACT')
    expect(contracts.map((doc) => doc.version)).toEqual([1, 2])
    // 每版各留各的汇率快照——同一包里两份文件汇率不同是常态，不是 bug
    expect(contracts.map((doc) => doc.exchangeRate)).toEqual(['7.152000', '7.210000'])
  })

  it('乐观锁不匹配时拒绝', async () => {
    const record = await createDossier(harness)
    await expect(
      harness.documents.generate(
        record.id,
        record.versionLock + 5,
        'CONTRACT',
        { posted: true, exchangeRate: '7.152000' },
        SALES,
      ),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.NOT_EDITABLE.code })
  })

  it('取最新一版；没生成过就抛 404 而不是返回空壳', async () => {
    const record = await createDossier(harness)
    const generated = await generatePackDocuments(record)
    expect(harness.documents.latestOf(generated, 'CONTRACT').version).toBe(1)
    expect(() => harness.documents.latestOf(generated, 'PROFORMA_INVOICE')).toThrow(
      expect.objectContaining({ code: CUSTOMS_ERRORS.DOCUMENT_NOT_FOUND.code }),
    )
  })
})

describe('EXP-02 关务复核不可跳过', () => {
  it('业务复核不了自己填的要素', async () => {
    const record = await createDossier(harness)
    const submitted = await harness.declarations.submitForReview(
      record.id,
      record.versionLock,
      SALES,
    )
    await expect(
      harness.declarations.approveReview(submitted.id, submitted.versionLock, SALES),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.CUSTOMS_ROLE_REQUIRED.code })
  })

  it('复核通过后记下复核人', async () => {
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
    expect(approved.status).toBe('GENERATED')
    expect(approved.checkedBy).toBe(BROKER.userCode)
  })

  it('复核发现要素错可以退回补正，复核人一并清掉', async () => {
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
    const returned = await harness.declarations.returnForFix(
      approved.id,
      approved.versionLock,
      BROKER,
    )
    expect(returned.status).toBe('CHECKING')
    expect(returned.checkedBy).toBeNull()
  })

  it('没人复核过就不许申报', async () => {
    const record = await createDossier(harness)
    const withDocs = await generatePackDocuments(record)
    // 直接把状态推到 GENERATED 而绕过复核（模拟越权改库），申报仍应被拦下
    const forced = await harness.repo.patch(withDocs.id, withDocs.versionLock, {
      status: 'GENERATED',
      updatedBy: SALES.userCode,
    })
    await expect(
      harness.declarations.declare(forced!.id, forced!.versionLock, BROKER),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.REVIEW_REQUIRED.code })
  })
})

describe('EXP-04 申报：不可变边界', () => {
  it('申报冻结清单快照，记下每种文件的当前版本', async () => {
    const record = await createDossier(harness)
    const declared = await toDeclared(record)

    expect(declared.status).toBe('DECLARED')
    expect(declared.declarationVersion).toBe(1)
    expect(declared.declarations).toHaveLength(1)
    expect(declared.declarations[0]!.lines).toEqual([
      { kind: 'COMMERCIAL_INVOICE', version: 1 },
      { kind: 'CONTRACT', version: 1 },
      { kind: 'PACKING_LIST', version: 1 },
    ])
  })

  it('申报之前重出文件是日常迭代，不要求理由', async () => {
    const record = await createDossier(harness)
    const withDocs = await generatePackDocuments(record)
    const again = await harness.documents.generate(
      withDocs.id,
      withDocs.versionLock,
      'CONTRACT',
      { posted: true, exchangeRate: '7.152000' },
      SALES,
    )
    expect(again.corrections).toHaveLength(0)
  })

  it('申报之后重出文件，再走更正：快照不动，产生新的一版申报', async () => {
    const record = await createDossier(harness)
    const declared = await toDeclared(record)

    const reissued = await harness.documents.generate(
      declared.id,
      declared.versionLock,
      'COMMERCIAL_INVOICE',
      { posted: true, exchangeRate: '7.300000' },
      SALES,
    )
    const corrected = await harness.declarations.correct(
      reissued.id,
      reissued.versionLock,
      '客户要求把英文品名改为海关归类用词',
      BROKER,
    )

    // 第一版快照原样留着——它是复现当时陈述的唯一依据
    expect(corrected.declarations[0]!.lines).toEqual([
      { kind: 'COMMERCIAL_INVOICE', version: 1 },
      { kind: 'CONTRACT', version: 1 },
      { kind: 'PACKING_LIST', version: 1 },
    ])
    expect(corrected.declarationVersion).toBe(2)
    expect(corrected.declarations[1]!.lines).toContainEqual({
      kind: 'COMMERCIAL_INVOICE',
      version: 2,
    })
  })

  it('更正内容是算出来的，不让人手填——手填的清单迟早跟实际对不上', async () => {
    const record = await createDossier(harness)
    const declared = await toDeclared(record)
    const reissued = await harness.documents.generate(
      declared.id,
      declared.versionLock,
      'PACKING_LIST',
      { posted: true, exchangeRate: '7.152000' },
      SALES,
    )
    const corrected = await harness.declarations.correct(
      reissued.id,
      reissued.versionLock,
      '毛重复磅后修正',
      BROKER,
    )

    expect(corrected.corrections[0]!.lines).toEqual([
      { kind: 'PACKING_LIST', fromVersion: 1, toVersion: 2 },
    ])
  })

  it('更正必须写理由', async () => {
    const record = await createDossier(harness)
    const declared = await toDeclared(record)
    await expect(
      harness.declarations.correct(declared.id, declared.versionLock, '   ', BROKER),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.CORRECTION_REASON_REQUIRED.code })
  })

  it('一份都没重出就不该建更正记录——空更正只是噪音', async () => {
    const record = await createDossier(harness)
    const declared = await toDeclared(record)
    await expect(
      harness.declarations.correct(declared.id, declared.versionLock, '想改点什么', BROKER),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.CORRECTION_LINES_REQUIRED.code })
  })

  it('没申报过就谈不上更正，直接重新生成即可', async () => {
    const record = await createDossier(harness)
    const withDocs = await generatePackDocuments(record)
    await expect(
      harness.declarations.correct(withDocs.id, withDocs.versionLock, '理由', BROKER),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.CORRECTION_REQUIRES_DECLARATION.code })
  })

  it('更正后通知业务员，理由一并带上', async () => {
    const record = await createDossier(harness)
    const declared = await toDeclared(record)
    const reissued = await harness.documents.generate(
      declared.id,
      declared.versionLock,
      'CONTRACT',
      { posted: true, exchangeRate: '7.152000' },
      SALES,
    )
    await harness.declarations.correct(reissued.id, reissued.versionLock, '合同条款更新', BROKER)

    expect(harness.notify).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'CUSTOMS', body: '更正理由：合同条款更新' }),
    )
  })
})

describe('EXP-04 回执与放行', () => {
  it('回执挂在当前申报版本上', async () => {
    const record = await createDossier(harness)
    const declared = await toDeclared(record)
    const archived = await harness.declarations.archiveReceipt(
      declared.id,
      declared.versionLock,
      'CN-DEC-20260728-771',
      BROKER,
    )
    expect(archived.declarations[0]!.receiptNo).toBe('CN-DEC-20260728-771')
  })

  it('同一版回执不许归档两次——重复归档会盖掉原始回执号', async () => {
    const record = await createDossier(harness)
    const declared = await toDeclared(record)
    const archived = await harness.declarations.archiveReceipt(
      declared.id,
      declared.versionLock,
      'CN-DEC-1',
      BROKER,
    )
    await expect(
      harness.declarations.archiveReceipt(archived.id, archived.versionLock, 'CN-DEC-2', BROKER),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.RECEIPT_ALREADY_ARCHIVED.code })
  })

  it('没申报就没有回执可归档', async () => {
    const record = await createDossier(harness)
    await expect(
      harness.declarations.archiveReceipt(record.id, record.versionLock, 'X', BROKER),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.CORRECTION_REQUIRES_DECLARATION.code })
  })

  it('放行到终点，之后不能再推进', async () => {
    const record = await createDossier(harness)
    const declared = await toDeclared(record)
    const released = await harness.declarations.release(
      declared.id,
      declared.versionLock,
      BROKER,
    )
    expect(released.status).toBe('RELEASED')
    expect(released.releasedAt).toBeInstanceOf(Date)

    await expect(
      harness.declarations.release(released.id, released.versionLock, BROKER),
    ).rejects.toThrow()
  })

  it('放行要关务权限', async () => {
    const record = await createDossier(harness)
    const declared = await toDeclared(record)
    await expect(
      harness.declarations.release(declared.id, declared.versionLock, SALES),
    ).rejects.toMatchObject({ code: CUSTOMS_ERRORS.CUSTOMS_ROLE_REQUIRED.code })
  })
})
