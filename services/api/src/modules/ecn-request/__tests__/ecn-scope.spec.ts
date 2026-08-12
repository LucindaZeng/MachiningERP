import { BizError } from '../../../common/errors/biz-error'
import {
  ECN_CHANGE_TYPES,
  REDIRECTED_INTENTS,
  assertEcnChangeType,
  isEcnChangeType,
  requiresEffectiveBatch,
  requiresNewDrawing,
  requiresRoutingSync,
} from '../constants/ecn-change-types'
import { ECN_IMPACT_SCOPES, missingImpactScopes } from '../constants/ecn-impact-scopes'
import { ECN_TRANSITIONS, ecnStateMachine, isEcnApproved, isEcnEditable, isEcnFinished } from '../constants/ecn-states'
import {
  assertImpactsAssessed,
  assertNewDrawingProvided,
  assertNotSampleStage,
  assertRejectReason,
  assertReleasable,
  suggestNeedRequote,
} from '../services/ecn-scope.rules'

/**
 * ECN 的四道闸门。
 *
 * 这一支是本模块的全部业务价值所在——别的部分都是取数与状态迁移，
 * 而「该不该受理、能不能批」全在这里，因此逐条分支钉死。
 */

describe('受理范围闸门', () => {
  it('四种产品变更全部放行', () => {
    for (const type of ECN_CHANGE_TYPES) {
      expect(assertEcnChangeType(type)).toBe(type)
      expect(isEcnChangeType(type)).toBe(true)
    }
  })

  it('订单类诉求被拒，且**点名**去订单修改申请', () => {
    for (const intent of ['quantity', 'delivery', 'shipTo', 'packing', 'cancel']) {
      try {
        assertEcnChangeType(intent)
        throw new Error(`${intent} 应当被拒绝`)
      } catch (error) {
        expect(BizError.is(error)).toBe(true)
        expect((error as BizError).code).toBe('ORD_3004')
        expect((error as BizError).message).toContain('订单修改申请')
      }
    }
  })

  it('改价被拒，且点名去报价单修改申请', () => {
    try {
      assertEcnChangeType('price')
      throw new Error('应当被拒绝')
    } catch (error) {
      expect((error as BizError).message).toContain('报价单修改申请')
      expect((error as BizError).message).toContain('QRC')
    }
  })

  it('没有登记去处的未知类型也要拒，并说明 ECN 到底收什么', () => {
    try {
      assertEcnChangeType('unknown-thing')
      throw new Error('应当被拒绝')
    } catch (error) {
      const message = (error as BizError).message
      expect(message).toContain('改图')
      expect(message).toContain('改材料')
      expect(message).toContain('改表面处理')
    }
    expect(isEcnChangeType('unknown-thing')).toBe(false)
  })

  it('重定向表覆盖了订单修改的全部类型——两个模块的边界必须对得上', () => {
    for (const intent of ['quantity', 'delivery', 'shipTo', 'packing', 'cancel', 'price']) {
      expect(REDIRECTED_INTENTS[intent]).toBeDefined()
    }
  })
})

describe('样品阶段重定向（业务规格 4.3）', () => {
  it('样品订单上的变更被推回报价变更路径，并报出订单号', () => {
    try {
      assertNotSampleStage({ orderType: 'SAMPLE', docNo: 'SO-SAMPLE-1' })
      throw new Error('应当被拒绝')
    } catch (error) {
      expect((error as BizError).code).toBe('ORD_3005')
      expect((error as BizError).message).toContain('SO-SAMPLE-1')
      expect((error as BizError).message).toContain('报价单修改申请')
    }
  })

  it('正式 / 模具 / 备料订单一律放行', () => {
    for (const orderType of ['FORMAL', 'MOLD', 'STOCK_PREP'] as const) {
      expect(() => assertNotSampleStage({ orderType, docNo: 'SO-1' })).not.toThrow()
    }
  })

  it('未关联订单时放行——无从判定则不拦，由工程在评估环节人工把关', () => {
    expect(() => assertNotSampleStage(null)).not.toThrow()
  })
})

describe('改图必须给出新版图纸', () => {
  it('改图缺新版图纸被拒', () => {
    expect(() => assertNewDrawingProvided('DRAWING', null)).toThrow(BizError)
    try {
      assertNewDrawingProvided('DRAWING', null)
    } catch (error) {
      expect((error as BizError).code).toBe('ORD_3006')
    }
  })

  it('改图给了新版图纸就放行', () => {
    expect(() => assertNewDrawingProvided('DRAWING', 'DV-2')).not.toThrow()
  })

  it('改材料 / 改表面处理 / 改工序不要求新版图纸', () => {
    for (const type of ['MATERIAL', 'SURFACE', 'PROCESS'] as const) {
      expect(() => assertNewDrawingProvided(type, null)).not.toThrow()
      expect(requiresNewDrawing(type)).toBe(false)
    }
    expect(requiresNewDrawing('DRAWING')).toBe(true)
  })
})

describe('评估齐套闸门', () => {
  it('四项齐了才放行', () => {
    expect(() => assertImpactsAssessed(ECN_IMPACT_SCOPES)).not.toThrow()
  })

  it('缺项时**一次列全**，不做补一项报一项', () => {
    try {
      assertImpactsAssessed(['WIP'])
      throw new Error('应当被拒绝')
    } catch (error) {
      const message = (error as BizError).message
      expect((error as BizError).code).toBe('ORD_3009')
      expect(message).toContain('已采购物料')
      expect(message).toContain('已完工库存')
      expect(message).toContain('已发货批次')
    }
  })

  it('一项都没评时四项全报', () => {
    expect(missingImpactScopes([])).toEqual([...ECN_IMPACT_SCOPES])
  })

  it('最容易漏的「已发货批次」单独漏掉也会被抓住', () => {
    expect(missingImpactScopes(['WIP', 'PURCHASED', 'FINISHED_STOCK'])).toEqual(['SHIPPED'])
  })
})

describe('发布前置闸门', () => {
  it('改图未同步工艺路线不许批准', () => {
    try {
      assertReleasable({ changeType: 'DRAWING', routingUpdated: false, effectiveBatch: null })
      throw new Error('应当被拒绝')
    } catch (error) {
      expect((error as BizError).code).toBe('ORD_3007')
    }
  })

  it('改图已同步工艺路线即可批准', () => {
    expect(() =>
      assertReleasable({ changeType: 'DRAWING', routingUpdated: true, effectiveBatch: null }),
    ).not.toThrow()
  })

  it('改工序未指定生效批次不许批准——否则已投产批次会被无声改掉', () => {
    try {
      assertReleasable({ changeType: 'PROCESS', routingUpdated: true, effectiveBatch: null })
      throw new Error('应当被拒绝')
    } catch (error) {
      expect((error as BizError).code).toBe('ORD_3008')
    }
    expect(() =>
      assertReleasable({ changeType: 'PROCESS', routingUpdated: false, effectiveBatch: 'B2607 起' }),
    ).not.toThrow()
  })

  it('改材料 / 改表面处理不受这两条前置约束', () => {
    for (const changeType of ['MATERIAL', 'SURFACE'] as const) {
      expect(() =>
        assertReleasable({ changeType, routingUpdated: false, effectiveBatch: null }),
      ).not.toThrow()
      expect(requiresRoutingSync(changeType)).toBe(false)
      expect(requiresEffectiveBatch(changeType)).toBe(false)
    }
  })
})

describe('驳回理由', () => {
  it('空、纯空白、undefined 一律拒', () => {
    for (const reason of ['', '   ', null, undefined]) {
      try {
        assertRejectReason(reason)
        throw new Error('应当被拒绝')
      } catch (error) {
        expect((error as BizError).code).toBe('ORD_3010')
      }
    }
  })

  it('有理由时去掉首尾空白返回', () => {
    expect(assertRejectReason('  影响面过大，等下一批次一起改  ')).toBe(
      '影响面过大，等下一批次一起改',
    )
  })
})

describe('状态机', () => {
  it('批准之后没有回头路——已经对外生效的东西不回滚，只追加', () => {
    expect(ecnStateMachine.can('APPROVED', 'ASSESSING')).toBe(false)
    expect(ecnStateMachine.can('APPROVED', 'REJECTED')).toBe(false)
    expect(ecnStateMachine.can('APPROVED', 'EXECUTING')).toBe(true)
  })

  it('提交后的任一环节都可以驳回——「不该做」在哪一步都可能被看出来', () => {
    for (const from of ['SUBMITTED', 'ASSESSING', 'REVIEWING'] as const) {
      expect(ecnStateMachine.can(from, 'REJECTED')).toBe(true)
    }
  })

  it('两条回头路：评估退回补充、会签打回重评', () => {
    expect(ecnStateMachine.can('ASSESSING', 'SUBMITTED')).toBe(true)
    expect(ecnStateMachine.can('REVIEWING', 'ASSESSING')).toBe(true)
  })

  it('非法迁移抛 SYS_9012 并列出允许项', () => {
    try {
      ecnStateMachine.assert('DRAFT', 'APPROVED')
      throw new Error('应当被拒绝')
    } catch (error) {
      expect((error as BizError).code).toBe('SYS_9012')
      expect((error as BizError).message).toContain('SUBMITTED')
    }
  })

  it('终态没有出边', () => {
    expect(ECN_TRANSITIONS.CLOSED).toEqual([])
    expect(ECN_TRANSITIONS.REJECTED).toEqual([])
    expect(ecnStateMachine.isTerminal('CLOSED')).toBe(true)
    expect(ecnStateMachine.isTerminal('REJECTED')).toBe(true)
  })

  it('三个状态判定函数各管各的', () => {
    expect(isEcnEditable('DRAFT')).toBe(true)
    expect(isEcnEditable('SUBMITTED')).toBe(true)
    expect(isEcnEditable('ASSESSING')).toBe(false)

    expect(isEcnApproved('APPROVED')).toBe(true)
    expect(isEcnApproved('EXECUTING')).toBe(true)
    expect(isEcnApproved('CLOSED')).toBe(true)
    expect(isEcnApproved('REVIEWING')).toBe(false)

    expect(isEcnFinished('CLOSED')).toBe(true)
    expect(isEcnFinished('REJECTED')).toBe(true)
    expect(isEcnFinished('EXECUTING')).toBe(false)
  })
})

describe('重新核价建议', () => {
  it('改材料与改表面处理**建议**重新核价，但只是建议', () => {
    expect(suggestNeedRequote('MATERIAL')).toBe(true)
    expect(suggestNeedRequote('SURFACE')).toBe(true)
    // 改图与改工序是否影响价格要看工时，判断依据在尚未上线的成本模块
    expect(suggestNeedRequote('DRAWING')).toBe(false)
    expect(suggestNeedRequote('PROCESS')).toBe(false)
  })
})
