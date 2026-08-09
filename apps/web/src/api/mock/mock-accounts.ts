import { PERMISSION_CODES } from '@machining-erp/shared'

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

/**
 * 角色 → 权限点，与后端 `services/api/prisma/seeds/roles.seed.ts` 保持同一份口径。
 * 关键差异：香港 70% 价格只有被单独授予的业务人员可见；成本核算只有报价工程师能做。
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SYS_ADMIN: [PERMISSION_CODES.IT_ACCOUNT_ADMIN],
  EXECUTIVE: [PERMISSION_CODES.STOCK_ORDER_GM_APPROVE, PERMISSION_CODES.ORDER_TRACKING_VIEW],
  SALES_MANAGER: [
    PERMISSION_CODES.HK_PRICE_VIEW,
    PERMISSION_CODES.SALES_OPERATE,
    PERMISSION_CODES.INVOICE_APPLY,
    PERMISSION_CODES.QUOTE_APPROVE,
    PERMISSION_CODES.ORDER_APPROVE,
    PERMISSION_CODES.ORDER_TRACKING_VIEW,
    PERMISSION_CODES.CUSTOMER_SENSITIVE_EDIT,
  ],
  SALES_REP: [
    PERMISSION_CODES.SALES_OPERATE,
    PERMISSION_CODES.INVOICE_APPLY,
    PERMISSION_CODES.ORDER_TRACKING_VIEW,
  ],
  QUOTE_ENGINEER: [
    PERMISSION_CODES.COSTING_EDIT,
    PERMISSION_CODES.QUOTE_CHANGE_HANDLE,
    PERMISSION_CODES.MATERIAL_PRICE_EDIT,
  ],
  PMC_PLANNER: [PERMISSION_CODES.ORDER_TRACKING_VIEW],
  SUPPLIER_PORTAL: [],
}

function permissionsOf(roles: string[]): string[] {
  return [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []))]
}

function account(
  audience: LoginAudience,
  user: Omit<LoginUser, 'permissions'>,
  extra: Omit<MockAccount, 'audience' | 'password' | 'user'> = {},
): MockAccount {
  return {
    audience,
    password: audience === 'portal' ? 'Portal@2026' : 'Wfx@2026',
    user: { ...user, permissions: permissionsOf(user.roles) },
    ...extra,
  }
}

/**
 * 演示账号：与后端 `prisma/seeds/users.seed.ts` 一一对应，
 * 把 `VITE_USE_MOCK` 从 true 切到 false 后行为一致。
 */
export const MOCK_ACCOUNTS: MockAccount[] = [
  account('internal', {
    id: 'U0001',
    userCode: 'WFX-2019-0001',
    account: 'admin',
    displayName: '系统管理员',
    department: 'IT',
    roles: ['SYS_ADMIN'],
  }),
  account('internal', {
    id: 'U0002',
    userCode: 'WFX-2016-0007',
    account: 'lucinda',
    displayName: '罗经理',
    department: '总经办',
    roles: ['EXECUTIVE'],
  }),
  account('internal', {
    id: 'U0042',
    userCode: 'WFX-2018-0042',
    account: 'luoxiaolin',
    displayName: '罗晓琳',
    department: '业务部',
    roles: ['SALES_MANAGER'],
  }),
  account('internal', {
    id: 'U0088',
    userCode: 'WFX-2020-0088',
    account: 'chenzhiqiang',
    displayName: '陈志强',
    department: '业务部',
    roles: ['SALES_REP'],
  }),
  account('internal', {
    id: 'U0113',
    userCode: 'WFX-2019-0113',
    account: 'wugong',
    displayName: '吴工',
    department: '工程部',
    roles: ['QUOTE_ENGINEER'],
  }),
  account('internal', {
    id: 'U0101',
    userCode: 'WFX-2021-0134',
    account: 'pmc01',
    displayName: '陈计划',
    department: 'PMC',
    roles: ['PMC_PLANNER'],
  }),
  account(
    'internal',
    {
      id: 'U0208',
      userCode: 'WFX-2022-0208',
      account: 'liwentao',
      displayName: '李文涛（已离职）',
      department: '品质部',
      roles: [],
    },
    { employment: 'left', leftAt: '2026-05-31', formerHolder: '李文涛（原品质部）' },
  ),
  account('portal', {
    id: 'P2001',
    userCode: 'WFX-P-2024-0031',
    account: 'sup001',
    displayName: '东莞精锻五金（供应商）',
    department: '供应商门户',
    roles: ['SUPPLIER_PORTAL'],
  }),
]

export function findMockAccount(audience: LoginAudience, account: string): MockAccount | undefined {
  const normalized = account.trim().toLowerCase()
  return MOCK_ACCOUNTS.find(
    (item) => item.audience === audience && item.user.account.toLowerCase() === normalized,
  )
}
