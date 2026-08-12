import { BizError } from '../../../common/errors/biz-error'
import { ECN_SIGNOFF_DEPARTMENTS } from '../constants/ecn-signoff'
import { assertSignoffComplete } from '../services/ecn-approval.service'

import {
  ENGINEER,
  FULL_IMPACTS,
  SALES,
  buildHarness,
  submittedDrawingEcn,
  type EcnHarness,
} from './harness'

import type { EcnRequestRecord } from '../repositories/ecn.repository.port'

/** 走到「待批准」为止的一条完整链路，供批准/驳回用例复用。 */
async function upToReview(harness: EcnHarness): Promise<EcnRequestRecord> {
  let record = await submittedDrawingEcn(harness)
  record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)
  record = await harness.impacts.assess(
    record.id,
    record.versionLock,
    {
      impacts: FULL_IMPACTS,
      routingUpdated: true,
      effectiveBatch: null,
      needRequote: true,
      needOrderReapproval: true,
    },
    ENGINEER,
  )
  record = await harness.impacts.submitForSignoff(record.id, record.versionLock, ENGINEER)
  return harness.approvals.recordSignoffs(record.id, record.versionLock, null, ENGINEER)
}

describe('ECN-01 提交', () => {
  it('提交即进入 SUBMITTED 并记下节点与审计', async () => {
    const harness = buildHarness()
    const record = await submittedDrawingEcn(harness)

    expect(record.status).toBe('SUBMITTED')
    expect(record.docNo).toMatch(/^ECN-/)
    expect(record.submittedAt).toBeInstanceOf(Date)
    expect(harness.timelineNodes[0]).toMatchObject({ node: 'ECN-01 业务提交变更申请' })
    expect(harness.audits[0]).toMatchObject({ action: 'ecn.submit' })
  })

  it('变更链路三者都落库，详情页据此追溯', async () => {
    const harness = buildHarness()
    const record = await submittedDrawingEcn(harness)

    expect(record.drawingVersionId).toBe('DV-1')
    expect(record.newDrawingVersionId).toBe('DV-2')
    expect(record.bomRequestId).toBe('BR-1')
    expect(record.quotationId).toBe('Q-1')
  })

  it('没有业务权限提不了', async () => {
    const harness = buildHarness()
    await expect(
      harness.requests.create(
        { ...baseInput(), changeType: 'MATERIAL' },
        null,
        { userCode: 'X', permissions: [] },
      ),
    ).rejects.toMatchObject({ code: 'ORD_3002' })
  })

  it('改数量在提交那一刻就被拒，工程根本不会看到它', async () => {
    const harness = buildHarness()
    await expect(
      harness.requests.create({ ...baseInput(), changeType: 'quantity' }, null, SALES),
    ).rejects.toMatchObject({ code: 'ORD_3004' })
    expect(harness.repository.rows).toHaveLength(0)
  })

  it('样品订单上的变更被推回报价路径，且不落库', async () => {
    const harness = buildHarness()
    await expect(
      harness.requests.create(
        { ...baseInput(), changeType: 'MATERIAL' },
        { orderType: 'SAMPLE', docNo: 'SO-S1' },
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_3005' })
    expect(harness.repository.rows).toHaveLength(0)
  })

  it('改图没给新版图纸时不落库', async () => {
    const harness = buildHarness()
    await expect(
      harness.requests.create(
        { ...baseInput(), changeType: 'DRAWING', newDrawingVersionId: null },
        null,
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_3006' })
    expect(harness.repository.rows).toHaveLength(0)
  })

  function baseInput() {
    return {
      customerId: 'C1',
      orderId: null,
      productName: '件',
      drawingNo: 'D-1',
      drawingVersionId: null,
      newDrawingVersionId: 'DV-9',
      bomRequestId: null,
      quotationId: null,
      changeType: 'DRAWING',
      origin: 'INTERNAL' as const,
      urgent: false,
      beforeValue: 'a',
      afterValue: 'b',
      reason: 'r',
    }
  }
})

describe('ECN-02 影响评估', () => {
  it('评估落四项、写下评估人，并把两个下游标志按人填的存下来', async () => {
    const harness = buildHarness()
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)
    record = await harness.impacts.assess(
      record.id,
      record.versionLock,
      {
        impacts: FULL_IMPACTS,
        routingUpdated: true,
        effectiveBatch: null,
        needRequote: true,
        needOrderReapproval: false,
      },
      ENGINEER,
    )

    expect(record.impacts).toHaveLength(4)
    expect(record.assessedBy).toBe(ENGINEER.userCode)
    expect(record.needRequote).toBe(true)
    expect(record.needOrderReapproval).toBe(false)
  })

  it('评不出金额的那一项落 null，而不是 0——两者含义相反', async () => {
    const harness = buildHarness()
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)
    record = await harness.impacts.assess(
      record.id,
      record.versionLock,
      { impacts: FULL_IMPACTS, routingUpdated: true, effectiveBatch: null, needRequote: false, needOrderReapproval: false },
      ENGINEER,
    )

    expect(record.impacts.find((item) => item.scope === 'SHIPPED')!.amountMinor).toBeNull()
    expect(record.impacts.find((item) => item.scope === 'FINISHED_STOCK')!.amountMinor).toBe(0n)
  })

  it('空字符串金额同样按「算不出钱」处理', async () => {
    const harness = buildHarness()
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)
    record = await harness.impacts.assess(
      record.id,
      record.versionLock,
      {
        impacts: [{ scope: 'WIP', quantity: '1', amountMinor: '  ', note: '' }],
        routingUpdated: true,
        effectiveBatch: null,
        needRequote: false,
        needOrderReapproval: false,
      },
      ENGINEER,
    )
    expect(record.impacts[0]!.amountMinor).toBeNull()
  })

  it('未知影响范围与重复范围都被拒', async () => {
    const harness = buildHarness()
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)

    await expect(
      harness.impacts.assess(
        record.id,
        record.versionLock,
        {
          impacts: [{ scope: 'NOWHERE', quantity: '1', amountMinor: null, note: '' }],
          routingUpdated: true, effectiveBatch: null, needRequote: false, needOrderReapproval: false,
        },
        ENGINEER,
      ),
    ).rejects.toMatchObject({ code: 'ORD_3009' })

    await expect(
      harness.impacts.assess(
        record.id,
        record.versionLock,
        {
          impacts: [
            { scope: 'WIP', quantity: '1', amountMinor: null, note: '' },
            { scope: 'WIP', quantity: '2', amountMinor: null, note: '' },
          ],
          routingUpdated: true, effectiveBatch: null, needRequote: false, needOrderReapproval: false,
        },
        ENGINEER,
      ),
    ).rejects.toMatchObject({ code: 'ORD_3011' })
  })

  it('业务角色不能自己评估自己提的变更', async () => {
    const harness = buildHarness()
    const record = await submittedDrawingEcn(harness)
    await expect(
      harness.impacts.assess(
        record.id,
        record.versionLock,
        { impacts: FULL_IMPACTS, routingUpdated: true, effectiveBatch: null, needRequote: false, needOrderReapproval: false },
        SALES,
      ),
    ).rejects.toMatchObject({ code: 'ORD_3003' })
  })

  it('四项没评全不许送会签', async () => {
    const harness = buildHarness()
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)
    record = await harness.impacts.assess(
      record.id,
      record.versionLock,
      {
        impacts: [FULL_IMPACTS[0]!],
        routingUpdated: true, effectiveBatch: null, needRequote: false, needOrderReapproval: false,
      },
      ENGINEER,
    )

    await expect(
      harness.impacts.submitForSignoff(record.id, record.versionLock, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_3009' })
  })

  it('过期的 versionLock 换来「请刷新后重试」，而不是静默覆盖', async () => {
    const harness = buildHarness()
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)

    await expect(
      harness.impacts.assess(
        record.id,
        record.versionLock - 1,
        { impacts: FULL_IMPACTS, routingUpdated: true, effectiveBatch: null, needRequote: false, needOrderReapproval: false },
        ENGINEER,
      ),
    ).rejects.toMatchObject({ code: 'ORD_3001' })
  })
})

describe('ECN-03 会签', () => {
  it('五个部门全部代签，且逐条标记 proxied', async () => {
    const harness = buildHarness()
    const record = await upToReview(harness)

    expect(record.signoffs).toHaveLength(ECN_SIGNOFF_DEPARTMENTS.length)
    expect(record.signoffs.every((item) => item.proxied)).toBe(true)
    expect(record.signoffs.every((item) => item.signedBy === ENGINEER.userCode)).toBe(true)
    // 未填意见时落默认代签说明，审计里能看出这不是部门自己签的
    expect(record.signoffs[0]!.opinion).toContain('尚未上线')
  })

  it('会签未完成不许批准，并报出缺哪几个部门', async () => {
    const harness = buildHarness()
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)
    record = await harness.impacts.assess(
      record.id, record.versionLock,
      { impacts: FULL_IMPACTS, routingUpdated: true, effectiveBatch: null, needRequote: false, needOrderReapproval: false },
      ENGINEER,
    )
    record = await harness.impacts.submitForSignoff(record.id, record.versionLock, ENGINEER)

    try {
      await harness.approvals.approve(record.id, record.versionLock, ENGINEER)
      throw new Error('应当被拒绝')
    } catch (error) {
      expect((error as BizError).code).toBe('ORD_3012')
      expect((error as BizError).message).toContain('PMC')
    }
  })

  it('assertSignoffComplete 只认真正签过的（signedAt 非空）', () => {
    const unsigned = {
      signoffs: ECN_SIGNOFF_DEPARTMENTS.map((department) => ({
        id: department, department, signedBy: null, signedAt: null, opinion: null, proxied: false,
      })),
    } as EcnRequestRecord
    expect(() => assertSignoffComplete(unsigned)).toThrow(BizError)
  })
})

describe('ECN-04 批准与驳回', () => {
  it('批准写下批准人、通知业务员，并把两个下游动作写进通知正文', async () => {
    const harness = buildHarness()
    const reviewed = await upToReview(harness)
    const approved = await harness.approvals.approve(reviewed.id, reviewed.versionLock, ENGINEER)

    expect(approved.status).toBe('APPROVED')
    expect(approved.approvedBy).toBe(ENGINEER.userCode)

    const notice = harness.notifications.at(-1)!
    expect(notice.recipientUserCode).toBe(SALES.userCode)
    expect(String(notice.title)).toContain('已批准')
    // 只提示、不代建 QRC / ORC
    expect(String(notice.body)).toContain('报价单修改申请')
    expect(String(notice.body)).toContain('订单修改申请')
  })

  it('改图未同步工艺路线时批准被拦——车间不会按新图做旧工艺', async () => {
    const harness = buildHarness()
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)
    record = await harness.impacts.assess(
      record.id, record.versionLock,
      { impacts: FULL_IMPACTS, routingUpdated: false, effectiveBatch: null, needRequote: false, needOrderReapproval: false },
      ENGINEER,
    )
    record = await harness.impacts.submitForSignoff(record.id, record.versionLock, ENGINEER)
    record = await harness.approvals.recordSignoffs(record.id, record.versionLock, null, ENGINEER)

    await expect(
      harness.approvals.approve(record.id, record.versionLock, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_3007' })
  })

  it('驳回必须填理由，且理由原样进通知', async () => {
    const harness = buildHarness()
    const reviewed = await upToReview(harness)

    await expect(
      harness.approvals.reject(reviewed.id, reviewed.versionLock, '   ', ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_3010' })

    const rejected = await harness.approvals.reject(
      reviewed.id, reviewed.versionLock, '影响面过大，等下一批次一起改', ENGINEER,
    )
    expect(rejected.status).toBe('REJECTED')
    expect(rejected.rejectReason).toBe('影响面过大，等下一批次一起改')
    expect(String(harness.notifications.at(-1)!.body)).toContain('影响面过大')
  })

  it('批准之后不能再驳回——已经对外生效的东西不回滚', async () => {
    const harness = buildHarness()
    const reviewed = await upToReview(harness)
    const approved = await harness.approvals.approve(reviewed.id, reviewed.versionLock, ENGINEER)

    await expect(
      harness.approvals.reject(approved.id, approved.versionLock, '反悔了', ENGINEER),
    ).rejects.toMatchObject({ code: 'SYS_9012' })
  })
})

describe('ECN-05 执行与结案', () => {
  it('批准 → 执行 → 结案，节点逐个落到时间线上', async () => {
    const harness = buildHarness()
    const reviewed = await upToReview(harness)
    let record = await harness.approvals.approve(reviewed.id, reviewed.versionLock, ENGINEER)
    record = await harness.approvals.startExecution(record.id, record.versionLock, ENGINEER)
    expect(record.status).toBe('EXECUTING')

    record = await harness.approvals.close(record.id, record.versionLock, ENGINEER)
    expect(record.status).toBe('CLOSED')
    expect(record.closedAt).toBeInstanceOf(Date)

    expect(harness.timelineNodes.map((node) => node.node)).toEqual([
      'ECN-01 业务提交变更申请',
      'ECN-02 工程影响评估',
      'ECN-03 跨部门影响会签',
      'ECN-04 变更批准与版本发布',
      'ECN-05 执行与批次切换',
    ])
    expect(String(harness.notifications.at(-1)!.title)).toContain('已结案')
  })

  it('改工序未指定生效批次时批不了', async () => {
    const harness = buildHarness()
    let record = await harness.requests.create(
      {
        customerId: 'C1', orderId: null, productName: '探头支架', drawingNo: 'RX-3390',
        drawingVersionId: 'DV-1', newDrawingVersionId: null, bomRequestId: null, quotationId: null,
        changeType: 'PROCESS', origin: 'INTERNAL', urgent: false,
        beforeValue: '工序 40 三轴', afterValue: '工序 40 四轴一次装夹', reason: '减少二次装夹误差',
      },
      null,
      SALES,
    )
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)
    record = await harness.impacts.assess(
      record.id, record.versionLock,
      { impacts: FULL_IMPACTS, routingUpdated: true, effectiveBatch: null, needRequote: false, needOrderReapproval: false },
      ENGINEER,
    )
    record = await harness.impacts.submitForSignoff(record.id, record.versionLock, ENGINEER)
    record = await harness.approvals.recordSignoffs(record.id, record.versionLock, null, ENGINEER)

    await expect(
      harness.approvals.approve(record.id, record.versionLock, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_3008' })
  })

  it('退回业务补充说明会退回 SUBMITTED', async () => {
    const harness = buildHarness()
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)
    record = await harness.requests.returnForDetail(record.id, record.versionLock, ENGINEER)
    expect(record.status).toBe('SUBMITTED')
  })

  it('查不到的 id 报 404 码；列表按状态过滤', async () => {
    const harness = buildHarness()
    await submittedDrawingEcn(harness)

    await expect(harness.requests.load('不存在')).rejects.toMatchObject({ code: 'ORD_3000' })
    expect(await harness.requests.list({ status: 'SUBMITTED' })).toHaveLength(1)
    expect(await harness.requests.list({ status: 'APPROVED' })).toHaveLength(0)
  })
})
