import type { LoginAudience, LoginUser } from '@/types/auth.types'

export interface MockAccount {
  audience: LoginAudience
  password: string
  user: LoginUser
  /** 在职状态：离职后**用户名**释放可被他人再次登记；唯一编码不释放、永不复用 */
  employment?: 'active' | 'left'
  /** 离职日期（用户名自该日起释放） */
  leftAt?: string
  /** 该用户名原使用人姓名，释放后登记时提示，便于人工确认不是同一个人 */
  formerHolder?: string
}

/** 演示账号：后端 auth 模块上线后随 VITE_USE_MOCK=false 一并停用。 */
export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    audience: 'internal',
    password: 'Wfx@2026',
    user: {
      id: 'U0001',
      userCode: 'WFX-2019-0001',
      account: 'admin',
      displayName: '系统管理员',
      department: '信息部',
      roles: ['SYS_ADMIN'],
    },
  },
  {
    audience: 'internal',
    password: 'Wfx@2026',
    user: {
      id: 'U0002',
      userCode: 'WFX-2016-0007',
      account: 'lucinda',
      displayName: '罗经理',
      department: '总经办',
      roles: ['EXECUTIVE', 'FINANCE_VIEW'],
    },
  },
  {
    audience: 'internal',
    password: 'Wfx@2026',
    user: {
      id: 'U0101',
      userCode: 'WFX-2021-0134',
      account: 'pmc01',
      displayName: '陈计划',
      department: 'PMC 部',
      roles: ['PMC_PLANNER'],
    },
  },
  {
    audience: 'internal',
    password: 'Wfx@2026',
    employment: 'left',
    leftAt: '2026-05-31',
    formerHolder: '李文涛（原品质部）',
    user: {
      id: 'U0208',
      userCode: 'WFX-2022-0208',
      account: 'liwentao',
      displayName: '李文涛（已离职）',
      department: '品质部',
      roles: [],
    },
  },
  {
    audience: 'portal',
    password: 'Portal@2026',
    user: {
      id: 'P2001',
      userCode: 'WFX-P-2024-0031',
      account: 'sup001',
      displayName: '东莞精锻五金（供应商）',
      department: '供应商门户',
      roles: ['SUPPLIER_PORTAL'],
    },
  },
]

export function findMockAccount(audience: LoginAudience, account: string): MockAccount | undefined {
  const normalized = account.trim().toLowerCase()
  return MOCK_ACCOUNTS.find(
    (item) => item.audience === audience && item.user.account.toLowerCase() === normalized,
  )
}
