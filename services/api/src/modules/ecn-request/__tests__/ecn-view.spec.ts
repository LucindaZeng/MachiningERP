import { PROXY_SIGNOFF_NOTE } from '../constants/ecn-signoff'
import { EcnContextService } from '../services/ecn-context.service'
import { toEcnRequestView } from '../services/ecn-view.mapper'

import { ENGINEER, SALES, assessInput, buildHarness, submittedDrawingEcn } from './harness'

import type { EcnRequestRecord } from '../repositories/ecn.repository.port'

const NAMING = { customerName: '香港宏晟精密（代生产）', orderNo: 'SO-1', ownerName: '罗晓琳' }
const LINKAGE = {
  drawingNo: 'HS-4471-A',
  fromRevision: 'REV C',
  fromVersionId: 'DV-1',
  toRevision: 'REV D',
  toVersionId: 'DV-2',
  bomRequestId: 'BR-1',
  quotationId: 'Q-1',
}

function record(overrides: Partial<EcnRequestRecord> = {}): EcnRequestRecord {
  return {
    id: 'EC1',
    docNo: 'ECN-20260727-0018',
    customerId: 'C1',
    orderId: 'O1',
    productName: '连接器外壳 CNC 件',
    drawingNo: 'HS-4471-A',
    drawingVersionId: 'DV-1',
    newDrawingVersionId: 'DV-2',
    bomRequestId: 'BR-1',
    quotationId: 'Q-1',
    changeType: 'DRAWING',
    origin: 'CUSTOMER',
    urgent: true,
    beforeValue: 'Rev.C',
    afterValue: 'Rev.D',
    reason: '客户端装配干涉',
    routingUpdated: false,
    effectiveBatch: null,
    needRequote: true,
    needOrderReapproval: true,
    status: 'ASSESSING',
    ownerUserCode: 'WFX-2018-0042',
    submittedAt: new Date(2026, 6, 27, 15, 40),
    assessedBy: null,
    assessedAt: null,
    approvedBy: null,
    approvedAt: null,
    closedAt: null,
    rejectReason: null,
    productionImpact: null,
    reworkInitiatedAt: null,
    reworkInitiatedBy: null,
    affectedLines: [],
    impacts: [
      { id: 'I1', scope: 'WIP', quantity: '1200 件', amountMinor: 1_411_200n, note: '待转序' },
      { id: 'I2', scope: 'SHIPPED', quantity: '0 件', amountMinor: null, note: '无' },
      { id: 'I3', scope: 'FINISHED_STOCK', quantity: '0 件', amountMinor: 0n, note: '无' },
    ],
    signoffs: [
      {
        id: 'S1',
        department: 'PMC',
        signedBy: 'WFX-2019-0011',
        signedAt: new Date(2026, 6, 28, 9, 5),
        opinion: PROXY_SIGNOFF_NOTE,
        proxied: true,
      },
    ],
    versionLock: 3,
    ...overrides,
  }
}

describe('视图映射', () => {
  it('枚举翻回前端那套小写值', () => {
    const view = toEcnRequestView(record(), NAMING, LINKAGE, [])
    expect(view.changeType).toBe('drawing')
    expect(view.status).toBe('assessing')
    expect(view.origin).toBe('customer')
  })

  it('内部发起翻成 internal', () => {
    expect(toEcnRequestView(record({ origin: 'INTERNAL' }), NAMING, LINKAGE, []).origin).toBe(
      'internal',
    )
  })

  it('八个状态都有对应的小写值，不会漏翻成 undefined', () => {
    const statuses = [
      'DRAFT', 'SUBMITTED', 'ASSESSING', 'REVIEWING',
      'APPROVED', 'EXECUTING', 'CLOSED', 'REJECTED',
    ] as const
    for (const status of statuses) {
      expect(toEcnRequestView(record({ status }), NAMING, LINKAGE, []).status).toBeTruthy()
    }
  })

  it('金额：评不出钱出「—」，评出零出「0.00」——两者含义相反', () => {
    const view = toEcnRequestView(record(), NAMING, LINKAGE, [])
    const byScope = new Map(view.impacts.map((impact) => [impact.scope, impact.amount]))

    expect(byScope.get('在制工单')).toBe('14112.00')
    expect(byScope.get('已发货批次')).toBe('—')
    expect(byScope.get('已完工库存')).toBe('0.00')
  })

  it('负数金额（返工冲回）也能正确成文', () => {
    const view = toEcnRequestView(
      record({
        impacts: [{ id: 'I1', scope: 'WIP', quantity: '1', amountMinor: -12_305n, note: '' }],
      }),
      NAMING,
      LINKAGE,
      [],
    )
    expect(view.impacts[0]!.amount).toBe('-123.05')
  })

  it('影响范围出中文标签，与界面上的说法一致', () => {
    const view = toEcnRequestView(record(), NAMING, LINKAGE, [])
    expect(view.impacts.map((impact) => impact.scope)).toEqual([
      '在制工单',
      '已发货批次',
      '已完工库存',
    ])
  })

  it('可空字段没值时不下发该键，而不是下发 undefined', () => {
    const view = toEcnRequestView(
      record({ effectiveBatch: null, rejectReason: null, submittedAt: null }),
      { ...NAMING, orderNo: null },
      LINKAGE,
      [],
    )
    expect('effectiveBatch' in view).toBe(false)
    expect('rejectReason' in view).toBe(false)
    expect('submittedAt' in view).toBe(false)
    expect('orderNo' in view).toBe(false)
  })

  it('有值时按 YYYY-MM-DD HH:mm 成文，与前端固件一致', () => {
    const view = toEcnRequestView(
      record({ effectiveBatch: 'B26071502 起生效', rejectReason: '影响面过大' }),
      NAMING,
      LINKAGE,
      [],
    )
    expect(view.submittedAt).toBe('2026-07-27 15:40')
    expect(view.effectiveBatch).toBe('B26071502 起生效')
    expect(view.rejectReason).toBe('影响面过大')
  })

  it('变更链路与会签明细原样带出，代签标记不丢', () => {
    const view = toEcnRequestView(record(), NAMING, LINKAGE, [])
    expect(view.linkage).toEqual(LINKAGE)
    expect(view.signoffs[0]).toMatchObject({
      department: 'PMC',
      proxied: true,
      signedAt: '2026-07-28 09:05',
    })
  })
})

describe('跨模块取名字的兜底', () => {
  function context(overrides: Record<string, unknown>): EcnContextService {
    return new EcnContextService(
      { load: overrides.loadOrder ?? (async () => ({ orderType: 'FORMAL', docNo: 'SO-1' })) } as never,
      { profileFor: overrides.profileFor ?? (async () => ({ name: '客户全称' })) } as never,
      { findByUserCode: overrides.findByUserCode ?? (async () => ({ displayName: '罗晓琳' })) } as never,
      { loadVersion: overrides.loadVersion ?? (async () => ({ revision: 'REV D' })) } as never,
    )
  }

  it('未关联订单时不去查，直接给 null', async () => {
    let called = false
    const service = context({
      loadOrder: async () => {
        called = true
        return { orderType: 'FORMAL', docNo: 'X' }
      },
    })
    expect(await service.orderFacts(null)).toBeNull()
    expect(await service.orderDocNo(null)).toBeNull()
    expect(called).toBe(false)
  })

  it('订单查不到时按「无从判定」处理，而不是让整张单打不开', async () => {
    const service = context({
      loadOrder: async () => {
        throw new Error('订单已删')
      },
    })
    expect(await service.orderFacts('O-DEAD')).toBeNull()
  })

  it('客户与用户查不到时退回原始标识', async () => {
    const service = context({
      profileFor: async () => {
        throw new Error('客户已停用')
      },
      findByUserCode: async () => null,
    })
    expect(await service.customerName('C-DEAD')).toBe('C-DEAD')
    expect(await service.displayName('WFX-9999')).toBe('WFX-9999')
  })

  it('图纸版本取不到时留空，不编版本号', async () => {
    const service = context({
      loadVersion: async () => {
        throw new Error('版本已删')
      },
    })
    const linkage = await service.linkage({
      drawingNo: 'D-1',
      drawingVersionId: 'DV-1',
      newDrawingVersionId: 'DV-2',
      bomRequestId: null,
      quotationId: null,
    })
    expect(linkage.fromRevision).toBeNull()
    expect(linkage.toRevision).toBeNull()
  })

  it('没有新版图纸时（改材料等）变更后版本为空', async () => {
    const service = context({})
    const linkage = await service.linkage({
      drawingNo: 'D-1',
      drawingVersionId: 'DV-1',
      newDrawingVersionId: null,
      bomRequestId: 'BR-1',
      quotationId: 'Q-1',
    })
    expect(linkage.fromRevision).toBe('REV D')
    expect(linkage.toRevision).toBeNull()
    expect(linkage.bomRequestId).toBe('BR-1')
  })
})

describe('视图组装与建单编排', () => {
  it('列表与详情把名字、链路、时间线都拼齐', async () => {
    const harness = buildHarness()
    const ecn = await submittedDrawingEcn(harness)

    const detail = await harness.reads.detail(ecn.id)
    expect(detail.customerName).toBe('客户-C1')
    expect(detail.orderNo).toBe('SO-O1')
    expect(detail.owner).toBe(`姓名-${SALES.userCode}`)
    expect(detail.linkage.fromRevision).toBe('REV DV-1')
    expect(detail.linkage.toRevision).toBe('REV DV-2')
    expect(detail.versionLock).toBe(ecn.versionLock)

    expect(await harness.reads.list({ status: 'SUBMITTED' })).toHaveLength(1)
    expect(await harness.reads.list({ status: 'APPROVED' })).toHaveLength(0)
  })

  it('facade 建单：先取订单事实判样品阶段，再出视图', async () => {
    const harness = buildHarness()
    const view = await harness.facade.createAndView(
      {
        customerId: 'C1', orderId: 'O1', productName: '件', drawingNo: 'D-1',
        newDrawingVersionId: 'DV-2', changeType: 'DRAWING', origin: 'CUSTOMER',
        urgent: false, beforeValue: 'a', afterValue: 'b', reason: 'r',
      } as never,
      SALES,
    )

    expect(view.status).toBe('submitted')
    expect(view.docNo).toMatch(/^ECN-/)
    expect(view.changeType).toBe('drawing')
  })

  it('未关联订单时 facade 也能建单（内部发起的工艺改善常常没有订单）', async () => {
    const harness = buildHarness()
    const view = await harness.facade.createAndView(
      {
        customerId: 'C1', productName: '件', drawingNo: 'D-1',
        changeType: 'MATERIAL', origin: 'INTERNAL',
        urgent: false, beforeValue: '304', afterValue: '316L', reason: '耐蚀等级提升',
      } as never,
      SALES,
    )
    expect('orderNo' in view).toBe(false)
    expect(view.changeType).toBe('material')
  })
})

describe('会签意见与批准通知的其余分支', () => {
  it('迁状态时撞上版本冲突同样报「请刷新后重试」', async () => {
    const harness = buildHarness()
    const ecn = await submittedDrawingEcn(harness)
    await expect(
      harness.requests.startAssessment(ecn.id, ecn.versionLock + 3, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_3001' })
  })

  it('填了会签意见就用填的，不套默认代签说明', async () => {
    const harness = buildHarness()
    let ecn = await submittedDrawingEcn(harness)
    ecn = await harness.requests.startAssessment(ecn.id, ecn.versionLock, ENGINEER)
    ecn = await harness.impacts.assess(
      ecn.id, ecn.versionLock,
      assessInput(),
      ENGINEER,
    )
    ecn = await harness.impacts.submitForSignoff(ecn.id, ecn.versionLock, ENGINEER)
    ecn = await harness.approvals.recordSignoffs(ecn.id, ecn.versionLock, '产能可吸收，同意', ENGINEER)

    expect(ecn.signoffs.every((item) => item.opinion === '产能可吸收，同意')).toBe(true)
  })

  it('两个下游标志都为假时，通知正文不提 QRC / ORC', async () => {
    const harness = buildHarness()
    let ecn = await submittedDrawingEcn(harness)
    ecn = await harness.requests.startAssessment(ecn.id, ecn.versionLock, ENGINEER)
    ecn = await harness.impacts.assess(
      ecn.id, ecn.versionLock,
      assessInput(),
      ENGINEER,
    )
    ecn = await harness.impacts.submitForSignoff(ecn.id, ecn.versionLock, ENGINEER)
    ecn = await harness.approvals.recordSignoffs(ecn.id, ecn.versionLock, null, ENGINEER)
    await harness.approvals.approve(ecn.id, ecn.versionLock, ENGINEER)

    const body = String(harness.notifications.at(-1)!.body)
    expect(body).toContain('图纸版本变更已批准发布')
    expect(body).not.toContain('报价单修改申请')
    expect(body).not.toContain('订单修改申请')
  })

  it('有生效批次时写进通知正文——车间要知道从哪一批开始', async () => {
    const harness = buildHarness()
    let ecn = await harness.requests.create(
      {
        customerId: 'C1', orderId: null, productName: '探头支架', drawingNo: 'RX-3390',
        drawingVersionId: null, newDrawingVersionId: null, bomRequestId: null, quotationId: null,
        changeType: 'PROCESS', origin: 'INTERNAL', urgent: false,
        beforeValue: '三轴', afterValue: '四轴', reason: '减少装夹误差',
      },
      null,
      SALES,
    )
    ecn = await harness.requests.startAssessment(ecn.id, ecn.versionLock, ENGINEER)
    ecn = await harness.impacts.assess(
      ecn.id, ecn.versionLock,
      assessInput({ effectiveBatch: 'B26071502 起生效' }),
      ENGINEER,
    )
    ecn = await harness.impacts.submitForSignoff(ecn.id, ecn.versionLock, ENGINEER)
    ecn = await harness.approvals.recordSignoffs(ecn.id, ecn.versionLock, null, ENGINEER)
    await harness.approvals.approve(ecn.id, ecn.versionLock, ENGINEER)

    expect(String(harness.notifications.at(-1)!.body)).toContain('B26071502 起生效')
  })

  it('评估分两步写；第二步撞上版本冲突时同样报「请刷新后重试」', async () => {
    const harness = buildHarness()
    let ecn = await submittedDrawingEcn(harness)
    ecn = await harness.requests.startAssessment(ecn.id, ecn.versionLock, ENGINEER)

    // 影响明细写成功之后、表头补丁之前，被另一个写入者抢先递了版本号
    const original = harness.repository.patch.bind(harness.repository)
    let calls = 0
    harness.repository.patch = async (...args) => {
      calls += 1
      return calls === 1 ? null : original(...args)
    }

    await expect(
      harness.impacts.assess(
        ecn.id, ecn.versionLock,
        assessInput(),
        ENGINEER,
      ),
    ).rejects.toMatchObject({ code: 'ORD_3001' })
  })

  it('会签阶段的乐观锁冲突同样报「请刷新后重试」', async () => {
    const harness = buildHarness()
    const ecn = await submittedDrawingEcn(harness)
    await expect(
      harness.approvals.recordSignoffs(ecn.id, ecn.versionLock + 5, null, ENGINEER),
    ).rejects.toMatchObject({ code: 'ORD_3001' })
  })
})
