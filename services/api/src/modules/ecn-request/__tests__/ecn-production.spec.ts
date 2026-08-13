import { AFFECTED_QTY_RULE } from '../constants/ecn-production-impact'
import { totalAffectedQty } from '../services/ecn-production.service'

import {
  ENGINEER,
  PMC,
  SALES,
  assessInput,
  buildHarness,
  submittedDrawingEcn,
  type EcnHarness,
} from './harness'

import type { EcnRequestRecord } from '../repositories/ecn.repository.port'

/**
 * 生产影响分类（业务规格第 6 章，新增规则）。
 *
 * 这支用例守的是一条很容易被「顺手放行」掉的规则：
 * 未判定生产影响就往下走，等于把清点与返工一起悄悄跳过，
 * 而跳过的后果要到车间按旧图做完才发现。
 */

const LINES = [
  { productName: '连接器外壳 CNC 件', drawingNo: 'HS-4471-A', affectedQty: '320', note: '车床已开粗' },
  { productName: '连接器压盖', drawingNo: 'HS-4471-B', affectedQty: '80', note: null },
]

/** 走到「执行中」——结案闸门的上一站。 */
async function upToExecuting(
  harness: EcnHarness,
  productionImpact: string,
): Promise<EcnRequestRecord> {
  let record = await submittedDrawingEcn(harness)
  record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)
  record = await harness.impacts.assess(
    record.id,
    record.versionLock,
    assessInput({ productionImpact }),
    ENGINEER,
  )
  record = await harness.impacts.submitForSignoff(record.id, record.versionLock, ENGINEER)
  record = await harness.approvals.recordSignoffs(record.id, record.versionLock, null, ENGINEER)
  record = await harness.approvals.approve(record.id, record.versionLock, ENGINEER)
  return harness.approvals.startExecution(record.id, record.versionLock, ENGINEER)
}

describe('分类必填', () => {
  it('未判定生产影响不许送会签', async () => {
    const harness = buildHarness()
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)

    record = await harness.impacts.assess(record.id, record.versionLock, assessInput(), ENGINEER)

    // 四项评全、但分类被抹掉——历史数据与「跳过 assess 直接送会签」都是这个形状
    harness.repository.rows.find((row) => row.id === record.id)!.productionImpact = null
    const reloaded = await harness.requests.load(record.id)

    await expect(
      harness.impacts.submitForSignoff(reloaded.id, reloaded.versionLock, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_3013' })
  })

  it('认不出来的分类值直接拒，不落成「无影响」', async () => {
    const harness = buildHarness()
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)

    await expect(
      harness.impacts.assess(
        record.id,
        record.versionLock,
        assessInput({ productionImpact: '大概有点影响吧' }),
        ENGINEER,
      ),
    ).rejects.toMatchObject({ code: 'ORD_3013' })
  })

  it('前端那套小写值与服务端枚举都收', async () => {
    const harness = buildHarness()
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)
    record = await harness.impacts.assess(
      record.id,
      record.versionLock,
      assessInput({ productionImpact: 'impacted' }),
      ENGINEER,
    )

    expect(record.productionImpact).toBe('IMPACTED')
  })

  it('判为「有影响」送会签时叫 PMC 来清点，并把计数口径写进通知', async () => {
    const harness = buildHarness()
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)
    record = await harness.impacts.assess(
      record.id,
      record.versionLock,
      assessInput({ productionImpact: 'impacted' }),
      ENGINEER,
    )
    await harness.impacts.submitForSignoff(record.id, record.versionLock, ENGINEER)

    const notice = harness.notifications.at(-1)!
    expect(String(notice.title)).toContain('PMC 待清点')
    expect(String(notice.body)).toContain('车床/CNC')
    expect(notice.recipientUserCodes).toEqual(['PMC-001'])
  })

  it('一个 PMC 都没配时照常送会签——通知发不出去不该把流程堵死', async () => {
    const harness = buildHarness({ pmcUserCodes: [] })
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)
    record = await harness.impacts.assess(
      record.id,
      record.versionLock,
      assessInput({ productionImpact: 'impacted' }),
      ENGINEER,
    )
    const advanced = await harness.impacts.submitForSignoff(
      record.id,
      record.versionLock,
      ENGINEER,
    )

    expect(advanced.status).toBe('REVIEWING')
    expect(
      harness.notifications.some((item) => String(item.title ?? '').includes('PMC 待清点')),
    ).toBe(false)
  })
})

describe('无影响的路径原样不动', () => {
  it('无影响的变更不惊动 PMC', async () => {
    const harness = buildHarness()
    let record = await submittedDrawingEcn(harness)
    record = await harness.requests.startAssessment(record.id, record.versionLock, ENGINEER)
    record = await harness.impacts.assess(
      record.id,
      record.versionLock,
      assessInput({ productionImpact: 'none' }),
      ENGINEER,
    )
    await harness.impacts.submitForSignoff(record.id, record.versionLock, ENGINEER)

    expect(
      harness.notifications.some((item) => String(item.title ?? '').includes('PMC 待清点')),
    ).toBe(false)
  })

  it('无影响的变更不录数量、不发返工，照样能结案', async () => {
    const harness = buildHarness()
    const record = await upToExecuting(harness, 'none')
    const closed = await harness.approvals.close(record.id, record.versionLock, ENGINEER)

    expect(closed.status).toBe('CLOSED')
    expect(closed.affectedLines).toHaveLength(0)
    expect(closed.reworkInitiatedAt).toBeNull()
    expect(harness.events).toHaveLength(0)
  })

  it('无影响的变更不能发起返工——它没有已投产的东西要返', async () => {
    const harness = buildHarness()
    const record = await upToExecuting(harness, 'none')

    await expect(
      harness.production.initiateRework(record.id, record.versionLock, PMC),
    ).rejects.toMatchObject({ code: 'ORD_3013' })
  })
})

describe('PMC 清点录入', () => {
  it('整表录入，留下录入人与计数口径', async () => {
    const harness = buildHarness()
    const record = await upToExecuting(harness, 'impacted')
    const saved = await harness.production.enterQuantities(
      record.id,
      record.versionLock,
      LINES,
      PMC,
    )

    expect(saved.affectedLines).toHaveLength(2)
    expect(saved.affectedLines[0]!.enteredBy).toBe(PMC.userCode)
    expect(saved.affectedLines[0]!.affectedQty).toBe('320')
    expect(saved.affectedLines[1]!.note).toBeNull()
    expect(totalAffectedQty(saved)).toBe(400)

    const entry = harness.audits.at(-1)!
    expect(entry.action).toBe('ecn.affected-qty.enter')
    expect((entry.after as Record<string, unknown>).rule).toBe(AFFECTED_QTY_RULE)
  })

  it('返工发起前可以反复改——清点常要跑两趟车间', async () => {
    const harness = buildHarness()
    let record = await upToExecuting(harness, 'impacted')
    record = await harness.production.enterQuantities(record.id, record.versionLock, LINES, PMC)
    record = await harness.production.enterQuantities(
      record.id,
      record.versionLock,
      [{ ...LINES[0]!, affectedQty: '355' }],
      PMC,
    )

    expect(record.affectedLines).toHaveLength(1)
    expect(record.affectedLines[0]!.affectedQty).toBe('355')
  })

  it('版本冲突时报「请刷新后重试」，不静默覆盖别人刚录的数', async () => {
    const harness = buildHarness()
    const record = await upToExecuting(harness, 'impacted')

    await expect(
      harness.production.enterQuantities(record.id, record.versionLock + 3, LINES, PMC),
    ).rejects.toMatchObject({ code: 'ORD_3001' })
  })
})

describe('PMC 角色门禁', () => {
  it('业务不能替生产报这个数', async () => {
    const harness = buildHarness()
    const record = await upToExecuting(harness, 'impacted')

    await expect(
      harness.production.enterQuantities(record.id, record.versionLock, LINES, SALES),
    ).rejects.toMatchObject({ code: 'ORD_3014' })
  })

  it('工程岗也不行——评估权限不等于清点权限', async () => {
    const harness = buildHarness()
    const record = await upToExecuting(harness, 'impacted')

    await expect(
      harness.production.initiateRework(record.id, record.versionLock, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_3014' })
  })
})

describe('返工发起', () => {
  it('发出的事件带新旧图纸版本与逐行数量——只给一个数，车间无从判断该返成什么样', async () => {
    const harness = buildHarness()
    let record = await upToExecuting(harness, 'impacted')
    record = await harness.production.enterQuantities(record.id, record.versionLock, LINES, PMC)
    record = await harness.production.initiateRework(record.id, record.versionLock, PMC)

    expect(record.reworkInitiatedAt).toBeInstanceOf(Date)
    expect(record.reworkInitiatedBy).toBe(PMC.userCode)

    const event = harness.events.at(-1)!
    expect(event.name).toBe('engineering.ecn.rework-requested')
    const payload = event.payload as Record<string, unknown>
    expect(payload.ecnDocNo).toBe(record.docNo)
    expect(payload.fromDrawingVersionId).toBe('DV-1')
    expect(payload.toDrawingVersionId).toBe('DV-2')
    expect(payload.fromRevision).toBe('REV DV-1')
    expect(payload.toRevision).toBe('REV DV-2')
    expect(payload.lines).toEqual([
      { productName: LINES[0]!.productName, drawingNo: LINES[0]!.drawingNo, affectedQty: '320' },
      { productName: LINES[1]!.productName, drawingNo: LINES[1]!.drawingNo, affectedQty: '80' },
    ])
  })

  it('一个数都没录不许发起返工', async () => {
    const harness = buildHarness()
    const record = await upToExecuting(harness, 'impacted')

    await expect(
      harness.production.initiateRework(record.id, record.versionLock, PMC),
    ).rejects.toMatchObject({ code: 'ORD_3016' })
  })

  it('返工不能重复发起', async () => {
    const harness = buildHarness()
    let record = await upToExecuting(harness, 'impacted')
    record = await harness.production.enterQuantities(record.id, record.versionLock, LINES, PMC)
    record = await harness.production.initiateRework(record.id, record.versionLock, PMC)

    await expect(
      harness.production.initiateRework(record.id, record.versionLock, PMC),
    ).rejects.toMatchObject({ code: 'ORD_3018' })
  })

  it('版本冲突时报「请刷新后重试」', async () => {
    const harness = buildHarness()
    let record = await upToExecuting(harness, 'impacted')
    record = await harness.production.enterQuantities(record.id, record.versionLock, LINES, PMC)

    await expect(
      harness.production.initiateRework(record.id, record.versionLock + 3, PMC),
    ).rejects.toMatchObject({ code: 'ORD_3001' })
  })
})

describe('数量在返工发起后锁死', () => {
  it('返工已发起就不许再改数量——车间手上的工单是按这个数拆的', async () => {
    const harness = buildHarness()
    let record = await upToExecuting(harness, 'impacted')
    record = await harness.production.enterQuantities(record.id, record.versionLock, LINES, PMC)
    record = await harness.production.initiateRework(record.id, record.versionLock, PMC)

    await expect(
      harness.production.enterQuantities(
        record.id,
        record.versionLock,
        [{ ...LINES[0]!, affectedQty: '999' }],
        PMC,
      ),
    ).rejects.toMatchObject({ code: 'ORD_3015' })
  })
})

describe('结案闸门', () => {
  it('有影响但没录数量不许结案', async () => {
    const harness = buildHarness()
    const record = await upToExecuting(harness, 'impacted')

    await expect(
      harness.approvals.close(record.id, record.versionLock, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_3016' })
  })

  it('录了数量但没发起返工同样不许结案', async () => {
    const harness = buildHarness()
    let record = await upToExecuting(harness, 'impacted')
    record = await harness.production.enterQuantities(record.id, record.versionLock, LINES, PMC)

    await expect(
      harness.approvals.close(record.id, record.versionLock, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_3017' })
  })

  it('两步都完成后才放行', async () => {
    const harness = buildHarness()
    let record = await upToExecuting(harness, 'impacted')
    record = await harness.production.enterQuantities(record.id, record.versionLock, LINES, PMC)
    record = await harness.production.initiateRework(record.id, record.versionLock, PMC)

    const closed = await harness.approvals.close(record.id, record.versionLock, ENGINEER)
    expect(closed.status).toBe('CLOSED')
  })
})
