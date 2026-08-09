/**
 * 业务部权限码与角色映射。
 * 说明：M1 接入后端后由 auth 模块下发权限集合，此处的 ROLE_PERMISSIONS 仅作前端演示与兜底。
 */
import { computed } from 'vue'

import { useRoleStore } from '@/stores/role.store'

export const PERMISSIONS = {
  /** 查看与设置香港 70% 价格规则（仅业务部） */
  HK_PRICE_VIEW: 'sales.hk-price.view',
  /** 成本核算（建立 / 修改成本分析），仅报价工程师 */
  COSTING_EDIT: 'quote.costing.edit',
  /** 报价单修改申请的处理（改成本分析 / 驳回），仅报价工程师 */
  QUOTE_CHANGE_HANDLE: 'quote.change.handle',
  /** 提交报价申请、下单、出货等业务操作 */
  SALES_OPERATE: 'sales.operate',
  /** 发票申请提交 */
  INVOICE_APPLY: 'sales.invoice.apply',
} as const

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export interface DemoRole {
  code: string
  name: string
  department: string
  permissions: PermissionCode[]
  hint: string
}

/**
 * 演示角色。真实环境由角色-权限矩阵维护，见 docs/product/department-control-matrix.md。
 * 关键差异：香港 70% 价格设定只有业务部角色可见；成本核算只有报价工程师可做。
 */
export const DEMO_ROLES: DemoRole[] = [
  {
    code: 'SALES_MANAGER',
    name: '业务部主管 · 罗晓琳',
    department: '业务部',
    permissions: [
      PERMISSIONS.HK_PRICE_VIEW,
      PERMISSIONS.SALES_OPERATE,
      PERMISSIONS.INVOICE_APPLY,
    ],
    hint: '业务部权限：可见香港 70% 价格设定；不能做成本核算',
  },
  {
    code: 'SALES_REP',
    name: '业务员（非业务部权限）· 陈志强',
    department: '业务部（受限）',
    permissions: [PERMISSIONS.SALES_OPERATE, PERMISSIONS.INVOICE_APPLY],
    hint: '普通业务员：香港 70% 价格设定不可见，价格按系统计算结果展示',
  },
  {
    code: 'QUOTE_ENGINEER',
    name: '报价工程师 · 吴工',
    department: '工程部 · 报价组',
    permissions: [PERMISSIONS.COSTING_EDIT, PERMISSIONS.QUOTE_CHANGE_HANDLE],
    hint: '报价工程师：唯一可做成本核算与处理报价修改申请的角色；不做下单',
  },
]

export function usePermission() {
  const roleStore = useRoleStore()

  const role = computed(() => roleStore.current)
  const permissions = computed<PermissionCode[]>(() => role.value.permissions)

  function can(code: PermissionCode): boolean {
    return permissions.value.includes(code)
  }

  const canViewHkPrice = computed(() => can(PERMISSIONS.HK_PRICE_VIEW))
  const canEditCosting = computed(() => can(PERMISSIONS.COSTING_EDIT))
  const canHandleQuoteChange = computed(() => can(PERMISSIONS.QUOTE_CHANGE_HANDLE))
  const canOperateSales = computed(() => can(PERMISSIONS.SALES_OPERATE))

  return { role, permissions, can, canViewHkPrice, canEditCosting, canHandleQuoteChange, canOperateSales }
}
