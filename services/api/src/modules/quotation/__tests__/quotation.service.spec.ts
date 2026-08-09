import { PERMISSION_CODES } from '@machining-erp/shared'

import { CostingService } from '../services/costing.service'

import {
  ENGINEER,
  SALES,
  UNIT_COST_ROW_1,
  buildHarness,
  draftPayload,
  seedCompletedAnalysis,
  type Harness,
} from './quotation-harness'

const MANAGER_CODE = 'WFX-2015-0007'

async function ready(): Promise<{
  harness: Harness
  analysisId: string
  lineIds: string[]
}> {
  const harness = buildHarness()
  const { id, lineIds } = await seedCompletedAnalysis(harness)
  return { harness, analysisId: id, lineIds }
}

describe('建单闸门', () => {
  it('业务岗位才能建报价单', async () => {
    const { harness, analysisId, lineIds } = await ready()

    await expect(
      harness.quotations.create(draftPayload(analysisId, lineIds), ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_2211' })
  })

  it('成本分析还在草稿时不能据此建单', async () => {
    const harness = buildHarness()
    const draft = await harness.costing.create(
      { customerId: 'CU1', productModel: 'X', lines: [] },
      ENGINEER,
    )

    await expect(
      harness.quotations.create(draftPayload(draft.id, []), SALES),
    ).rejects.toMatchObject({ code: 'ORD_2211', message: expect.stringContaining('尚未核价完成') })
  })

  it('成本分析不存在直接报 ORD_2200', async () => {
    const harness = buildHarness()

    await expect(harness.quotations.create(draftPayload('nope', []), SALES)).rejects.toMatchObject({
      code: 'ORD_2200',
    })
  })

  it('缺图纸的行会被点名，且提示里带产品名', async () => {
    const { harness, analysisId, lineIds } = await ready()
    const payload = draftPayload(analysisId, lineIds)
    payload.items[0]!.drawingVersionId = null

    await expect(harness.quotations.create(payload, SALES)).rejects.toMatchObject({
      code: 'ORD_2211',
      message: expect.stringContaining('必须上传图纸'),
    })
  })

  it('一行产品都没有也建不了', async () => {
    const { harness, analysisId, lineIds } = await ready()

    await expect(
      harness.quotations.create(draftPayload(analysisId, lineIds, { items: [] }), SALES),
    ).rejects.toMatchObject({ code: 'ORD_2211' })
  })

  it('阶梯数量段不递增会被挡下', async () => {
    const { harness, analysisId, lineIds } = await ready()
    const payload = draftPayload(analysisId, lineIds)
    payload.items[0]!.tiers = [
      { minQuantity: '100', unitPriceMinor: 29_000n, label: null },
      { minQuantity: '10', unitPriceMinor: 32_000n, label: null },
    ]

    await expect(harness.quotations.create(payload, SALES)).rejects.toMatchObject({
      code: 'ORD_2211',
      message: expect.stringContaining('递增'),
    })
  })
})

describe('单件成本由后端贴，前端说了不算', () => {
  it('每一档的成本快照来自成本分析对应行', async () => {
    const { harness, analysisId, lineIds } = await ready()
    const record = await harness.quotations.create(draftPayload(analysisId, lineIds), SALES)

    expect(record.items[0]?.tiers.map((tier) => tier.unitCostMinor)).toEqual([
      UNIT_COST_ROW_1,
      UNIT_COST_ROW_1,
    ])
  })

  it('没挂成本分析行的产品成本记 0，提交时必然被判低于成本', async () => {
    const { harness, analysisId, lineIds } = await ready()
    const payload = draftPayload(analysisId, lineIds)
    payload.items[0]!.costAnalysisLineId = null

    const record = await harness.quotations.create(payload, SALES)
    expect(record.items[0]?.tiers[0]?.unitCostMinor).toBe(0n)
  })

  it('模具费单列，不摊进任何一档单价', async () => {
    const { harness, analysisId, lineIds } = await ready()
    const record = await harness.quotations.create(
      draftPayload(analysisId, lineIds, { moldFeeMinor: 500_000n }),
      SALES,
    )

    expect(record.moldFeeMinor).toBe(500_000n)
    expect(record.items[0]?.tiers.map((tier) => tier.unitPriceMinor)).toEqual([32_000n, 29_000n])
  })
})

describe('建单落地', () => {
  it('取号、记编制节点、初始为草稿', async () => {
    const { harness, analysisId, lineIds } = await ready()
    const record = await harness.quotations.create(draftPayload(analysisId, lineIds), SALES)

    expect(record.docNo).toMatch(/^QTN/)
    expect(record.status).toBe('DRAFT')
    expect(record.createdBy).toBe(SALES.userCode)
    expect(harness.timelineEnter).toHaveBeenCalledWith(
      expect.objectContaining({ node: '报价单编制', ownerUserCode: SALES.userCode }),
    )
  })

  it('按客户能列出来', async () => {
    const { harness, analysisId, lineIds } = await ready()
    await harness.quotations.create(draftPayload(analysisId, lineIds), SALES)

    expect(await harness.quotations.listByCustomer('CU1')).toHaveLength(1)
    expect(await harness.quotations.listByCustomer('CU2')).toHaveLength(0)
  })

  it('单据不存在报 ORD_2210', async () => {
    const harness = buildHarness()
    await expect(harness.quotations.load('nope')).rejects.toMatchObject({ code: 'ORD_2210' })
  })
})

describe('草稿维护', () => {
  it('整单替换成功后版本号自增', async () => {
    const { harness, analysisId, lineIds } = await ready()
    const created = await harness.quotations.create(draftPayload(analysisId, lineIds), SALES)

    const payload = draftPayload(analysisId, lineIds)
    payload.items[0]!.tiers = [{ minQuantity: '50', unitPriceMinor: 31_000n, label: '促销价' }]
    const updated = await harness.quotations.updateDraft(
      created.id,
      created.versionLock,
      payload,
      SALES,
    )

    expect(updated.versionLock).toBe(created.versionLock + 1)
    expect(updated.items[0]?.tiers).toHaveLength(1)
    expect(updated.items[0]?.tiers[0]?.label).toBe('促销价')
  })

  it('拿旧版本号提交会被乐观锁挡下', async () => {
    const { harness, analysisId, lineIds } = await ready()
    const created = await harness.quotations.create(draftPayload(analysisId, lineIds), SALES)
    await harness.quotations.updateDraft(
      created.id,
      created.versionLock,
      draftPayload(analysisId, lineIds),
      SALES,
    )

    await expect(
      harness.quotations.updateDraft(
        created.id,
        created.versionLock,
        draftPayload(analysisId, lineIds),
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2213' })
  })

  it('已送审的单子不能直接改明细', async () => {
    const { harness, analysisId, lineIds } = await ready()
    const created = await harness.quotations.create(draftPayload(analysisId, lineIds), SALES)
    await harness.review.submit(created.id, created.versionLock, MANAGER_CODE, SALES)

    await expect(
      harness.quotations.updateDraft(created.id, 1, draftPayload(analysisId, lineIds), SALES),
    ).rejects.toMatchObject({ code: 'ORD_2213' })
  })

  it('非业务岗位改不了草稿', async () => {
    const { harness, analysisId, lineIds } = await ready()
    const created = await harness.quotations.create(draftPayload(analysisId, lineIds), SALES)

    await expect(
      harness.quotations.updateDraft(created.id, 0, draftPayload(analysisId, lineIds), {
        userCode: 'X',
        permissions: [PERMISSION_CODES.COSTING_EDIT],
      }),
    ).rejects.toMatchObject({ code: 'ORD_2211' })
  })
})

describe('核价角色闸门仍然生效', () => {
  it('业务员拿不到 CostingService 的写入口', () => {
    expect(() => CostingService.assertQuoteEngineer(SALES)).toThrow(/报价工程师/)
  })
})
