import { LINE_ROW_1 } from './fakes'
import {
  ENGINEER,
  MANAGER,
  SALES,
  buildHarness,
  draftPayload,
  seedCompletedAnalysis,
  type Harness,
} from './quotation-harness'

import type { QuoteChangeRequestRecord } from '../repositories/quote-change-request.repository.port'

const TARGETS = [{ itemSequence: 1, minQuantity: '100', targetPriceMinor: 26_000n }]

async function withRequest(): Promise<{
  harness: Harness
  request: QuoteChangeRequestRecord
  quotationId: string
}> {
  const harness = buildHarness()
  const { id, lineIds } = await seedCompletedAnalysis(harness)
  const quotation = await harness.quotations.create(draftPayload(id, lineIds), SALES)

  const request = await harness.changes.submit(
    {
      quotationId: quotation.id,
      targetPrices: TARGETS,
      reason: '客户压价到 260 元，请复核成本',
      engineerUserCode: ENGINEER.userCode,
    },
    SALES,
  )
  return { harness, request, quotationId: quotation.id }
}

describe('业务提交修改申请', () => {
  it('取号、留痕，并把待办推给报价工程师', async () => {
    const { harness, request } = await withRequest()

    expect(request.requestNo).toMatch(/^QCR/)
    expect(request.status).toBe('SUBMITTED')
    expect(request.submittedBy).toBe(SALES.userCode)
    expect(harness.notify).toHaveBeenLastCalledWith(
      expect.objectContaining({
        recipientUserCode: ENGINEER.userCode,
        category: 'QUOTE_CHANGE_REQUEST',
      }),
    )
  })

  it('不写原因不给提', async () => {
    const harness = buildHarness()
    const { id, lineIds } = await seedCompletedAnalysis(harness)
    const quotation = await harness.quotations.create(draftPayload(id, lineIds), SALES)

    await expect(
      harness.changes.submit(
        {
          quotationId: quotation.id,
          targetPrices: TARGETS,
          reason: '   ',
          engineerUserCode: ENGINEER.userCode,
        },
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2211' })
  })

  it('原因字段整个缺失也当作没写', async () => {
    const harness = buildHarness()
    const { id, lineIds } = await seedCompletedAnalysis(harness)
    const quotation = await harness.quotations.create(draftPayload(id, lineIds), SALES)

    await expect(
      harness.changes.submit(
        {
          quotationId: quotation.id,
          targetPrices: TARGETS,
          reason: undefined as unknown as string,
          engineerUserCode: ENGINEER.userCode,
        },
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2211' })
  })

  it('一档目标价都没给也不行', async () => {
    const harness = buildHarness()
    const { id, lineIds } = await seedCompletedAnalysis(harness)
    const quotation = await harness.quotations.create(draftPayload(id, lineIds), SALES)

    await expect(
      harness.changes.submit(
        {
          quotationId: quotation.id,
          targetPrices: [],
          reason: '压价',
          engineerUserCode: ENGINEER.userCode,
        },
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2211' })
  })

  it('报价单不存在时不落单', async () => {
    const harness = buildHarness()

    await expect(
      harness.changes.submit(
        {
          quotationId: 'nope',
          targetPrices: TARGETS,
          reason: '压价',
          engineerUserCode: ENGINEER.userCode,
        },
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2210' })
    expect(harness.changeRepo.rows).toHaveLength(0)
  })

  it('非业务岗位提不了', async () => {
    const harness = buildHarness()

    await expect(
      harness.changes.submit(
        {
          quotationId: 'X',
          targetPrices: TARGETS,
          reason: '压价',
          engineerUserCode: ENGINEER.userCode,
        },
        ENGINEER,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2211' })
  })
})

describe('报价工程师重核', () => {
  it('派生新的成本分析版本并挂到申请上', async () => {
    const { harness, request } = await withRequest()
    const revised = await harness.changes.revise(request.id, request.versionLock, null, ENGINEER)

    expect(revised.status).toBe('REVISED')
    expect(revised.handledBy).toBe(ENGINEER.userCode)
    expect(revised.revisedCostAnalysisId).toBeTruthy()

    const created = harness.costRepo.rows.at(-1)!
    expect(created.version).toBe(2)
    expect(created.rootId).toBe(harness.costRepo.rows[0]?.id)
    expect(created.lines).toHaveLength(2)
  })

  it('不传明细就复制原明细，报价工程师再在新版本上改', async () => {
    const { harness, request } = await withRequest()
    await harness.changes.revise(request.id, request.versionLock, null, ENGINEER)

    const created = harness.costRepo.rows.at(-1)!
    expect(created.lines[0]?.drawingNo).toBe(harness.costRepo.rows[0]?.lines[0]?.drawingNo)
    expect(created.lines[0]?.id).not.toBe(harness.costRepo.rows[0]?.lines[0]?.id)
  })

  it('可以直接带着改好的明细重核', async () => {
    const { harness, request } = await withRequest()
    await harness.changes.revise(
      request.id,
      request.versionLock,
      [{ ...LINE_ROW_1, machiningCostMinor: 15_000n }],
      ENGINEER,
    )

    const created = harness.costRepo.rows.at(-1)!
    expect(created.lines).toHaveLength(1)
    expect(created.lines[0]?.machiningCostMinor).toBe(15_000n)
  })

  it('重核可以只调费率不动明细——这正是「管理费从 5% 提到 10%」的走法', async () => {
    const { harness, request } = await withRequest()
    await harness.changes.revise(request.id, request.versionLock, null, ENGINEER, {
      lossBps: 700,
      overheadBps: 1000,
      vatBps: 1300,
    })

    const created = harness.costRepo.rows.at(-1)!
    expect(created).toMatchObject({ version: 2, lossBps: 700, overheadBps: 1000 })
    // 原版本的费率不受影响，历史报价仍按当时的口径可复算
    expect(harness.costRepo.rows[0]).toMatchObject({ lossBps: 500, overheadBps: 500 })
  })

  it('重核结果回到业务员的工作台', async () => {
    const { harness, request } = await withRequest()
    await harness.changes.revise(request.id, request.versionLock, null, ENGINEER)

    expect(harness.notify).toHaveBeenLastCalledWith(
      expect.objectContaining({
        recipientUserCode: SALES.userCode,
        category: 'QUOTE_CHANGE_RESULT',
        body: expect.stringContaining('第 2 版'),
      }),
    )
  })

  it('业务经理没有处理权限', async () => {
    const { harness, request } = await withRequest()

    await expect(
      harness.changes.revise(request.id, request.versionLock, null, MANAGER),
    ).rejects.toMatchObject({ code: 'ORD_2201' })
  })

  it('处理过的申请不能再处理一次', async () => {
    const { harness, request } = await withRequest()
    const revised = await harness.changes.revise(request.id, request.versionLock, null, ENGINEER)

    await expect(
      harness.changes.reject(revised.id, revised.versionLock, '再想想', ENGINEER),
    ).rejects.toMatchObject({ code: 'SYS_9012' })
  })
})

describe('报价工程师驳回', () => {
  it('理由必填，且原样回到业务员工作台', async () => {
    const { harness, request } = await withRequest()
    const rejected = await harness.changes.reject(
      request.id,
      request.versionLock,
      '  材料价已到底，无下调空间  ',
      ENGINEER,
    )

    expect(rejected.status).toBe('REJECTED')
    expect(rejected.rejectReason).toBe('材料价已到底，无下调空间')
    expect(harness.notify).toHaveBeenLastCalledWith(
      expect.objectContaining({
        recipientUserCode: SALES.userCode,
        body: '驳回理由：材料价已到底，无下调空间',
      }),
    )
  })

  it('空白理由报 ORD_2222', async () => {
    const { harness, request } = await withRequest()

    await expect(
      harness.changes.reject(request.id, request.versionLock, '  ', ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_2222', status: 422 })
  })

  it('驳回不产生新的成本分析版本', async () => {
    const { harness, request } = await withRequest()
    const before = harness.costRepo.rows.length
    await harness.changes.reject(request.id, request.versionLock, '无下调空间', ENGINEER)

    expect(harness.costRepo.rows).toHaveLength(before)
  })

  it('版本号对不上时按「已被处理」拒绝', async () => {
    const { harness, request } = await withRequest()

    await expect(
      harness.changes.reject(request.id, request.versionLock + 5, '无下调空间', ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_2221' })
  })
})

describe('查询', () => {
  it('按报价单列出全部申请', async () => {
    const { harness, request, quotationId } = await withRequest()

    expect(await harness.changes.listByQuotation(quotationId)).toHaveLength(1)
    expect((await harness.changes.load(request.id)).requestNo).toBe(request.requestNo)
  })

  it('申请不存在报 ORD_2220', async () => {
    const harness = buildHarness()
    await expect(harness.changes.load('nope')).rejects.toMatchObject({ code: 'ORD_2220' })
  })
})
