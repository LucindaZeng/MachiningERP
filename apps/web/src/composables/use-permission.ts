/**
 * 权限点判定。
 *
 * 权限的**唯一权威是登录态**：`POST /auth/login` 返回的 `user.permissions` 由后端
 * 按角色-权限矩阵算好（services/api `prisma/seeds/roles.seed.ts`）。
 * 只有在没有登录态时（原型演示 / mock），才退回下面的 DEMO_ROLES 角色切换器。
 *
 * 香港 70% 价格是**独立权限点**：未授予者在列表、详情、报表与导出中一律看不到
 * 勾选、原始价格与计算价格（docs/product/business-department-modules.md 3.2）。
 */
import { PERMISSION_CODES } from '@machining-erp/shared'
import { computed } from 'vue'

import { useAuthStore } from '@/stores/auth.store'
import { useRoleStore } from '@/stores/role.store'

export { PERMISSION_CODES }

/** 兼容旧引用：业务部页面里大量使用 `PERMISSIONS.HK_PRICE_VIEW` 这样的写法。 */
export const PERMISSIONS = PERMISSION_CODES

export type PermissionCode = (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES]

export interface DemoRole {
  code: string
  name: string
  department: string
  permissions: PermissionCode[]
  hint: string
}

/** 演示角色：仅在未登录时生效，用于在原型上直观演示权限差异。 */
export const DEMO_ROLES: DemoRole[] = [
  {
    code: 'SALES_MANAGER',
    name: '业务部主管 · 罗晓琳',
    department: '业务部',
    permissions: [
      PERMISSION_CODES.HK_PRICE_VIEW,
      PERMISSION_CODES.SALES_OPERATE,
      PERMISSION_CODES.INVOICE_APPLY,
    ],
    hint: '业务部权限：可见香港 70% 价格设定；不能做成本核算',
  },
  {
    code: 'SALES_REP',
    name: '业务员（非业务部权限）· 陈志强',
    department: '业务部（受限）',
    permissions: [PERMISSION_CODES.SALES_OPERATE, PERMISSION_CODES.INVOICE_APPLY],
    hint: '普通业务员：香港 70% 价格设定不可见，价格按系统计算结果展示',
  },
  {
    code: 'QUOTE_ENGINEER',
    name: '报价工程师 · 吴工',
    department: '工程部 · 报价组',
    permissions: [PERMISSION_CODES.COSTING_EDIT, PERMISSION_CODES.QUOTE_CHANGE_HANDLE],
    hint: '报价工程师：唯一可做成本核算与处理报价修改申请的角色；不做下单',
  },
]

export function usePermission() {
  const roleStore = useRoleStore()
  const authStore = useAuthStore()

  /** 登录后展示真实身份；未登录时才用演示角色。 */
  const role = computed<DemoRole>(() => {
    const user = authStore.user
    if (!user) return roleStore.current

    return {
      code: user.roles[0] ?? 'AUTHENTICATED',
      name: `${user.displayName} · ${user.userCode}`,
      department: user.department,
      permissions: user.permissions as PermissionCode[],
      hint: `由 auth 模块下发的权限集合（${user.permissions.length} 项）`,
    }
  })

  const permissions = computed<PermissionCode[]>(() => role.value.permissions)

  function can(code: PermissionCode): boolean {
    return permissions.value.includes(code)
  }

  const canViewHkPrice = computed(() => can(PERMISSION_CODES.HK_PRICE_VIEW))
  const canEditCosting = computed(() => can(PERMISSION_CODES.COSTING_EDIT))
  const canHandleQuoteChange = computed(() => can(PERMISSION_CODES.QUOTE_CHANGE_HANDLE))
  const canOperateSales = computed(() => can(PERMISSION_CODES.SALES_OPERATE))

  return {
    role,
    permissions,
    can,
    canViewHkPrice,
    canEditCosting,
    canHandleQuoteChange,
    canOperateSales,
  }
}
