import { BizError } from '../../../common/errors/biz-error'
import { StateMachine, type TransitionMap } from '../services/state-machine'

type QuotationStatus = 'DRAFT' | 'IN_REVIEW' | 'EFFECTIVE' | 'WON' | 'LOST' | 'EXPIRED'

/** 报价单状态机：草稿/审核中/生效/已成交/未成交/已失效（业务规格 2.1）。 */
const TRANSITIONS: TransitionMap<QuotationStatus> = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['EFFECTIVE', 'DRAFT'],
  EFFECTIVE: ['WON', 'LOST', 'EXPIRED'],
  WON: [],
  LOST: [],
  EXPIRED: [],
}

const machine = new StateMachine<QuotationStatus>('报价单', TRANSITIONS)

describe('状态机', () => {
  it('允许的迁移放行', () => {
    expect(machine.can('DRAFT', 'IN_REVIEW')).toBe(true)
    expect(machine.can('IN_REVIEW', 'DRAFT')).toBe(true)
    expect(() => machine.assert('EFFECTIVE', 'WON')).not.toThrow()
  })

  it('非法迁移抛 SYS_9012，并列出当前允许的目标状态', () => {
    const error = (() => {
      try {
        machine.assert('DRAFT', 'EFFECTIVE')
        return null
      } catch (caught) {
        return caught as BizError
      }
    })()

    expect(BizError.is(error)).toBe(true)
    expect(error?.code).toBe('SYS_9012')
    expect(error?.message).toContain('报价单')
    expect(error?.message).toContain('IN_REVIEW')
  })

  it('终态没有下一步，提示「无（终态）」', () => {
    expect(machine.isTerminal('WON')).toBe(true)
    expect(() => machine.assert('WON', 'DRAFT')).toThrow(/无（终态）/)
  })

  it('未声明的状态视为终态而不是崩溃', () => {
    expect(machine.nextStates('UNKNOWN' as QuotationStatus)).toEqual([])
    expect(machine.isTerminal('UNKNOWN' as QuotationStatus)).toBe(true)
  })

  it('nextStates 返回声明的迁移集合', () => {
    expect(machine.nextStates('EFFECTIVE')).toEqual(['WON', 'LOST', 'EXPIRED'])
  })
})

describe('未声明状态的兜底', () => {
  it('can / assert 遇到未声明的来源状态时按「无可迁移」处理', () => {
    expect(machine.can('UNKNOWN' as QuotationStatus, 'DRAFT')).toBe(false)
    expect(() => machine.assert('UNKNOWN' as QuotationStatus, 'DRAFT')).toThrow(/无（终态）/)
  })
})
