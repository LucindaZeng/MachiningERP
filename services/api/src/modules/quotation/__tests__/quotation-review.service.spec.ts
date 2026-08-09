import { BizError } from '../../../common/errors/biz-error'

import {
  ENGINEER,
  MANAGER,
  SALES,
  buildHarness,
  draftPayload,
  seedCompletedAnalysis,
  type Harness,
} from './quotation-harness'

import type { QuotationRecord } from '../repositories/quotation.repository.port'
import type { QuotationDraftPayload } from '../services/quotation.service'

async function withDraft(
  mutate?: (payload: QuotationDraftPayload) => void,
): Promise<{ harness: Harness; quotation: QuotationRecord }> {
  const harness = buildHarness()
  const { id, lineIds } = await seedCompletedAnalysis(harness)
  const payload = draftPayload(id, lineIds)
  mutate?.(payload)

  return { harness, quotation: await harness.quotations.create(payload, SALES) }
}

describe('送审', () => {
  it('提交后进入待审核，并给审核人发待办', async () => {
    const { harness, quotation } = await withDraft()
    const submitted = await harness.review.submit(
      quotation.id,
      quotation.versionLock,
      MANAGER.userCode,
      SALES,
    )

    expect(submitted.status).toBe('IN_REVIEW')
    expect(submitted.submittedBy).toBe(SALES.userCode)
    expect(harness.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserCode: MANAGER.userCode,
        category: 'QUOTATION_REVIEW',
      }),
    )
    expect(harness.timelineEnter).toHaveBeenCalledWith(
      expect.objectContaining({ node: '报价审核', ownerUserCode: MANAGER.userCode }),
    )
  })

  it('低于成本价被拦下，缺口逐档列清楚', async () => {
    const { harness, quotation } = await withDraft((payload) => {
      // 单件成本 270.74 元，这里按 200 元报
      payload.items[0]!.tiers = [{ minQuantity: '10', unitPriceMinor: 20_000n, label: null }]
    })

    await expect(
      harness.review.submit(quotation.id, quotation.versionLock, MANAGER.userCode, SALES),
    ).rejects.toMatchObject({
      code: 'ORD_2212',
      status: 422,
      message: expect.stringContaining('缺口'),
    })
  })

  it('低于成本的明细以字符串下发，不用 number 传分值', async () => {
    const { harness, quotation } = await withDraft((payload) => {
      payload.items[0]!.tiers = [{ minQuantity: '10', unitPriceMinor: 1n, label: null }]
    })

    const error = await harness.review
      .submit(quotation.id, quotation.versionLock, MANAGER.userCode, SALES)
      .then(() => null)
      .catch((caught: unknown) => caught as BizError)

    expect((error?.details as Array<Record<string, unknown>>)[0]).toMatchObject({
      unitPriceMinor: '1',
      unitCostMinor: '27074',
      shortfallMinor: '27073',
    })
  })

  it('刚好等于成本可以提交（拦的是「低于」不是「不高于」）', async () => {
    const { harness, quotation } = await withDraft((payload) => {
      payload.items[0]!.tiers = [{ minQuantity: '10', unitPriceMinor: 27_074n, label: null }]
    })

    const submitted = await harness.review.submit(
      quotation.id,
      quotation.versionLock,
      MANAGER.userCode,
      SALES,
    )
    expect(submitted.status).toBe('IN_REVIEW')
  })

  it('已在审核中的单子不能重复提交', async () => {
    const { harness, quotation } = await withDraft()
    const submitted = await harness.review.submit(
      quotation.id,
      quotation.versionLock,
      MANAGER.userCode,
      SALES,
    )

    await expect(
      harness.review.submit(submitted.id, submitted.versionLock, MANAGER.userCode, SALES),
    ).rejects.toMatchObject({ code: 'SYS_9012' })
  })

  it('非业务岗位不能送审', async () => {
    const { harness, quotation } = await withDraft()

    await expect(
      harness.review.submit(quotation.id, quotation.versionLock, MANAGER.userCode, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_2211' })
  })

  it('版本号对不上时不改状态', async () => {
    const { harness, quotation } = await withDraft()

    await expect(
      harness.review.submit(quotation.id, quotation.versionLock + 9, MANAGER.userCode, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2213' })
    expect((await harness.quotations.load(quotation.id)).status).toBe('DRAFT')
  })
})

describe('审核通过', () => {
  async function submitted(): Promise<{ harness: Harness; quotation: QuotationRecord }> {
    const { harness, quotation } = await withDraft()
    const record = await harness.review.submit(
      quotation.id,
      quotation.versionLock,
      MANAGER.userCode,
      SALES,
    )
    return { harness, quotation: record }
  }

  it('生效并锁定成本分析版本', async () => {
    const { harness, quotation } = await submitted()
    const approved = await harness.review.approve(
      quotation.id,
      quotation.versionLock,
      null,
      MANAGER,
    )

    expect(approved.status).toBe('EFFECTIVE')
    expect(approved.approvedBy).toBe(MANAGER.userCode)
    expect(harness.costRepo.rows[0]?.status).toBe('LOCKED')
  })

  it('锁版后核价改不动了，改价必须走修改申请', async () => {
    const { harness, quotation } = await submitted()
    await harness.review.approve(quotation.id, quotation.versionLock, null, MANAGER)

    const analysis = harness.costRepo.rows[0]!
    await expect(
      harness.costing.replaceLines(analysis.id, analysis.versionLock, [], ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_2202' })
  })

  it('不传有效期时按默认 30 天', async () => {
    const { harness, quotation } = await submitted()
    const approved = await harness.review.approve(
      quotation.id,
      quotation.versionLock,
      null,
      MANAGER,
    )

    const days = (approved.validUntil!.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThan(30.1)
  })

  it('显式传入的有效期优先', async () => {
    const { harness, quotation } = await submitted()
    const until = new Date('2026-12-31T00:00:00Z')
    const approved = await harness.review.approve(
      quotation.id,
      quotation.versionLock,
      until,
      MANAGER,
    )

    expect(approved.validUntil).toEqual(until)
  })

  it('业务员自己审不了自己的单', async () => {
    const { harness, quotation } = await submitted()

    await expect(
      harness.review.approve(quotation.id, quotation.versionLock, null, SALES),
    ).rejects.toMatchObject({ code: 'ORD_2211', message: expect.stringContaining('业务经理') })
  })

  it('草稿状态直接审核属于非法迁移', async () => {
    const { harness, quotation } = await withDraft()

    await expect(
      harness.review.approve(quotation.id, quotation.versionLock, null, MANAGER),
    ).rejects.toMatchObject({ code: 'SYS_9012' })
  })
})

describe('驳回', () => {
  async function submitted(): Promise<{ harness: Harness; quotation: QuotationRecord }> {
    const { harness, quotation } = await withDraft()
    const record = await harness.review.submit(
      quotation.id,
      quotation.versionLock,
      MANAGER.userCode,
      SALES,
    )
    return { harness, quotation: record }
  }

  it('退回草稿并把理由送到提交人手上', async () => {
    const { harness, quotation } = await submitted()
    const rejected = await harness.review.reject(
      quotation.id,
      quotation.versionLock,
      '  客户已有更低报价，请复核  ',
      MANAGER,
    )

    expect(rejected.status).toBe('DRAFT')
    expect(rejected.rejectReason).toBe('客户已有更低报价，请复核')
    expect(harness.notify).toHaveBeenLastCalledWith(
      expect.objectContaining({
        recipientUserCode: SALES.userCode,
        body: expect.stringContaining('客户已有更低报价'),
      }),
    )
  })

  it('理由是空白就不给驳回', async () => {
    const { harness, quotation } = await submitted()

    await expect(
      harness.review.reject(quotation.id, quotation.versionLock, '   ', MANAGER),
    ).rejects.toMatchObject({ code: 'ORD_2222' })
  })

  it('驳回后重新提交会清掉上一次的驳回理由', async () => {
    const { harness, quotation } = await submitted()
    const rejected = await harness.review.reject(
      quotation.id,
      quotation.versionLock,
      '价格偏高',
      MANAGER,
    )
    const resubmitted = await harness.review.submit(
      rejected.id,
      rejected.versionLock,
      MANAGER.userCode,
      SALES,
    )

    expect(resubmitted.rejectReason).toBeNull()
  })

  it('驳回节点按异常收尾，耗时统计才看得出返工', async () => {
    const { harness, quotation } = await submitted()
    await harness.review.reject(quotation.id, quotation.versionLock, '价格偏高', MANAGER)

    expect(harness.timelineEnter).toHaveBeenLastCalledWith(
      expect.objectContaining({ node: '报价单编制', previousStatus: 'ABNORMAL' }),
    )
  })
})

describe('结果通知的收件人', () => {
  /** 直接往仓储塞一条记录，模拟历史数据里提交人缺失的情形 */
  async function seedInReview(
    owner: Partial<Pick<QuotationRecord, 'submittedBy' | 'createdBy'>>,
  ): Promise<Harness> {
    const { harness, quotation } = await withDraft()
    const row = harness.quotationRepo.rows.find((item) => item.id === quotation.id)!
    Object.assign(row, { status: 'IN_REVIEW', submittedBy: null, createdBy: null, ...owner })
    harness.notify.mockClear()
    return harness
  }

  it('没有提交人时退回建单人', async () => {
    const harness = await seedInReview({ createdBy: 'WFX-2018-0099' })
    const row = harness.quotationRepo.rows[0]!
    await harness.review.approve(row.id, row.versionLock, null, MANAGER)

    expect(harness.notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserCode: 'WFX-2018-0099' }),
    )
  })

  it('两个都没有就不发通知，也不因此报错', async () => {
    const harness = await seedInReview({})
    const row = harness.quotationRepo.rows[0]!
    const approved = await harness.review.approve(row.id, row.versionLock, null, MANAGER)

    expect(approved.status).toBe('EFFECTIVE')
    expect(harness.notify).not.toHaveBeenCalled()
  })
})

describe('生效后的结果登记', () => {
  it('成交是终态，登记后不能再改成丢单', async () => {
    const { harness, quotation } = await withDraft()
    const inReview = await harness.review.submit(
      quotation.id,
      quotation.versionLock,
      MANAGER.userCode,
      SALES,
    )
    const effective = await harness.review.approve(
      inReview.id,
      inReview.versionLock,
      null,
      MANAGER,
    )
    const won = await harness.review.settle(
      effective.id,
      effective.versionLock,
      'WON',
      SALES,
    )

    expect(won.status).toBe('WON')
    await expect(
      harness.review.settle(won.id, won.versionLock, 'LOST', SALES),
    ).rejects.toMatchObject({ code: 'SYS_9012' })
  })
})
