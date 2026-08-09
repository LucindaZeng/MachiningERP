import { buildHandlerHint, buildReusedFrom } from '../services/account-request-hint'

const RELEASED = {
  formerAccount: 'liwentao',
  formerHolder: '李文涛',
  leftAt: new Date('2026-05-31T00:00:00Z'),
}

describe('原使用人提示', () => {
  it('全新登记时不提示原使用人', () => {
    expect(buildReusedFrom(null)).toBeNull()
  })

  it('复用离职释放的用户名时给出原使用人与离职日期', () => {
    expect(buildReusedFrom(RELEASED)).toBe('李文涛（2026-05-31 离职，用户名已释放）')
  })

  it('离职日期缺失时给出占位文案而不是 null', () => {
    expect(buildReusedFrom({ ...RELEASED, leftAt: null })).toContain('离职日期缺失')
  })
})

describe('受理提示', () => {
  it('全新登记：强调编码终身不变、永不复用', () => {
    const hint = buildHandlerHint('WFX-2026-0209', null)
    expect(hint).toContain('WFX-2026-0209')
    expect(hint).toContain('终身不变、永不复用')
    expect(hint).toContain('用户名仅作登录用途')
  })

  it('复用用户名：强调新编码与原使用人无关、不继承角色与待办', () => {
    const hint = buildHandlerHint('WFX-2026-0209', RELEASED)
    expect(hint).toContain('李文涛')
    expect(hint).toContain('与原使用人的编码无关')
    expect(hint).toContain('不继承其角色、数据范围与待办')
    expect(hint).toContain('历史单据关联的是唯一编码')
  })
})
