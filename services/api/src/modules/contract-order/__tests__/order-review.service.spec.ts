import { REVIEW_CHAIN, nextReviewStatus, reviewChainOf } from '../constants/order-states'

import {
  CROSS,
  FINANCE,
  GM,
  MANAGER,
  READY_CONTEXT,
  SALES,
  buildHarness,
  draft,
  type Harness,
} from './harness'

import type { SalesOrderRecord } from '../repositories/sales-order.repository.port'
import type { SalesOrderType } from '@prisma/client'

async function submitted(
  orderType: SalesOrderType = 'FORMAL',
): Promise<{ harness: Harness; order: SalesOrderRecord }> {
  const harness = buildHarness()
  const created = await harness.orders.create(draft(orderType), READY_CONTEXT, SALES)
  const order = await harness.review.submit(created.id, created.versionLock, READY_CONTEXT, SALES)
  return { harness, order }
}

describe('审核链的形状（业务规格 4.1 + 4.5）', () => {
  it('普通订单：业务经理 → 财务 → 跨部门评审 → 批准', () => {
    expect(REVIEW_CHAIN).toEqual(['MANAGER_REVIEW', 'FINANCE_REVIEW', 'CROSS_REVIEW', 'APPROVED'])
  })

  it('备料订单在财务与跨部门评审之间多一节总经办', () => {
    expect(reviewChainOf('STOCK_PREP')).toEqual([
      'MANAGER_REVIEW',
      'FINANCE_REVIEW',
      'GM_REVIEW',
      'CROSS_REVIEW',
      'APPROVED',
    ])
  })

  it('样品与模具订单不需要总经办', () => {
    expect(reviewChainOf('SAMPLE')).not.toContain('GM_REVIEW')
    expect(reviewChainOf('MOLD')).not.toContain('GM_REVIEW')
  })

  it('走到链尾后没有下一节', () => {
    expect(nextReviewStatus('APPROVED', 'FORMAL')).toBeNull()
    expect(nextReviewStatus('DRAFT', 'FORMAL')).toBeNull()
  })
})

describe('送审', () => {
  it('提交后进入业务经理审核，并记下 T0', async () => {
    const { order } = await submitted()

    expect(order.status).toBe('MANAGER_REVIEW')
    expect(order.submittedBy).toBe(SALES.userCode)
    expect(order.submittedAt).toBeInstanceOf(Date)
  })

  it('T0 起算的节点计时被记录', async () => {
    const { harness } = await submitted()

    expect(harness.timelineEnter).toHaveBeenLastCalledWith(
      expect.objectContaining({ node: '业务经理审核', ownerDept: '业务部' }),
    )
  })

  it('提交时会再跑一次下单校验——建单后 BOM 被退回就拦得住', async () => {
    const harness = buildHarness()
    const created = await harness.orders.create(draft(), READY_CONTEXT, SALES)

    await expect(
      harness.review.submit(
        created.id,
        created.versionLock,
        { customerReadyForOrder: true, bomConfirmed: {} },
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_2005' })
  })

  it('非业务岗位不能送审', async () => {
    const harness = buildHarness()
    const created = await harness.orders.create(draft(), READY_CONTEXT, SALES)

    await expect(
      harness.review.submit(created.id, created.versionLock, READY_CONTEXT, MANAGER),
    ).rejects.toMatchObject({ code: 'ORD_2012' })
  })

  it('已在审核中的单子不能重复提交', async () => {
    const { harness, order } = await submitted()

    await expect(
      harness.review.submit(order.id, order.versionLock, READY_CONTEXT, SALES),
    ).rejects.toMatchObject({ code: 'SYS_9012' })
  })
})

describe('逐节推进', () => {
  it('普通订单三节走完即批准', async () => {
    const { harness, order } = await submitted()

    const afterManager = await harness.review.approve(order.id, order.versionLock, MANAGER)
    expect(afterManager.status).toBe('FINANCE_REVIEW')

    const afterFinance = await harness.review.approve(
      afterManager.id,
      afterManager.versionLock,
      FINANCE,
    )
    expect(afterFinance.status).toBe('CROSS_REVIEW')

    const approved = await harness.review.approve(afterFinance.id, afterFinance.versionLock, CROSS)
    expect(approved.status).toBe('APPROVED')
    expect(approved.approvedAt).toBeInstanceOf(Date)
  })

  it('备料订单必须经过总经办那一节', async () => {
    const { harness, order } = await submitted('STOCK_PREP')

    const afterManager = await harness.review.approve(order.id, order.versionLock, MANAGER)
    const afterFinance = await harness.review.approve(
      afterManager.id,
      afterManager.versionLock,
      FINANCE,
    )

    expect(afterFinance.status).toBe('GM_REVIEW')
  })

  it('备料订单在总经办节点上，跨部门评审权限也推不动', async () => {
    const { harness, order } = await submitted('STOCK_PREP')
    const afterManager = await harness.review.approve(order.id, order.versionLock, MANAGER)
    const atGm = await harness.review.approve(afterManager.id, afterManager.versionLock, FINANCE)

    await expect(harness.review.approve(atGm.id, atGm.versionLock, CROSS)).rejects.toMatchObject({
      code: 'ORD_2014',
    })
  })

  it('总经办批准后才轮到跨部门评审', async () => {
    const { harness, order } = await submitted('STOCK_PREP')
    const a = await harness.review.approve(order.id, order.versionLock, MANAGER)
    const b = await harness.review.approve(a.id, a.versionLock, FINANCE)
    const c = await harness.review.approve(b.id, b.versionLock, GM)

    expect(c.status).toBe('CROSS_REVIEW')
    const approved = await harness.review.approve(c.id, c.versionLock, CROSS)
    expect(approved.status).toBe('APPROVED')
  })

  it('每一节只认自己那一个权限点：财务权限批不了业务经理这一节', async () => {
    const { harness, order } = await submitted()

    await expect(
      harness.review.approve(order.id, order.versionLock, FINANCE),
    ).rejects.toMatchObject({ code: 'ORD_2013' })
  })

  it('业务经理权限也批不了财务那一节', async () => {
    const { harness, order } = await submitted()
    const afterManager = await harness.review.approve(order.id, order.versionLock, MANAGER)

    await expect(
      harness.review.approve(afterManager.id, afterManager.versionLock, MANAGER),
    ).rejects.toMatchObject({ code: 'ORD_2013' })
  })

  it('草稿态的单子不在审核链上，批不了', async () => {
    const harness = buildHarness()
    const created = await harness.orders.create(draft(), READY_CONTEXT, SALES)

    await expect(
      harness.review.approve(created.id, created.versionLock, MANAGER),
    ).rejects.toMatchObject({ code: 'ORD_2008' })
  })

  it('批准后关闭节点计时并通知业务员', async () => {
    const { harness, order } = await submitted()
    const a = await harness.review.approve(order.id, order.versionLock, MANAGER)
    const b = await harness.review.approve(a.id, a.versionLock, FINANCE)
    await harness.review.approve(b.id, b.versionLock, CROSS)

    expect(harness.timelineClose).toHaveBeenCalled()
    expect(harness.notify).toHaveBeenLastCalledWith(
      expect.objectContaining({ recipientUserCode: SALES.userCode }),
    )
  })

  it('版本号对不上时状态不动', async () => {
    const { harness, order } = await submitted()

    await expect(
      harness.review.approve(order.id, order.versionLock + 9, MANAGER),
    ).rejects.toMatchObject({ code: 'ORD_2008' })
    expect((await harness.orders.load(order.id)).status).toBe('MANAGER_REVIEW')
  })
})

describe('驳回', () => {
  it('任何审核节点都能退回草稿，理由回到业务员手上', async () => {
    const { harness, order } = await submitted()
    const rejected = await harness.review.reject(
      order.id,
      order.versionLock,
      '  客户交期无法满足  ',
      MANAGER,
    )

    expect(rejected.status).toBe('DRAFT')
    expect(rejected.rejectReason).toBe('客户交期无法满足')
    expect(harness.notify).toHaveBeenLastCalledWith(
      expect.objectContaining({ body: expect.stringContaining('客户交期无法满足') }),
    )
  })

  it('财务节点驳回同样退回草稿', async () => {
    const { harness, order } = await submitted()
    const afterManager = await harness.review.approve(order.id, order.versionLock, MANAGER)

    const rejected = await harness.review.reject(
      afterManager.id,
      afterManager.versionLock,
      '客户授信不足',
      FINANCE,
    )
    expect(rejected.status).toBe('DRAFT')
  })

  it('理由是空白就不给驳回', async () => {
    const { harness, order } = await submitted()

    await expect(
      harness.review.reject(order.id, order.versionLock, '   ', MANAGER),
    ).rejects.toMatchObject({ code: 'ORD_2033' })
  })

  it('没有该节点权限的人驳回不了', async () => {
    const { harness, order } = await submitted()

    await expect(
      harness.review.reject(order.id, order.versionLock, '不同意', FINANCE),
    ).rejects.toMatchObject({ code: 'ORD_2013' })
  })

  it('驳回节点按异常收尾，返工在耗时统计里看得见', async () => {
    const { harness, order } = await submitted()
    await harness.review.reject(order.id, order.versionLock, '交期无法满足', MANAGER)

    expect(harness.timelineEnter).toHaveBeenLastCalledWith(
      expect.objectContaining({ node: '订单编制', previousStatus: 'ABNORMAL' }),
    )
  })

  it('驳回后重新提交会清掉上一次的驳回理由', async () => {
    const { harness, order } = await submitted()
    const rejected = await harness.review.reject(order.id, order.versionLock, '交期问题', MANAGER)

    const resubmitted = await harness.review.submit(
      rejected.id,
      rejected.versionLock,
      READY_CONTEXT,
      SALES,
    )
    expect(resubmitted.rejectReason).toBeNull()
  })
})
