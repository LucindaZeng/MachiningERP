import { PERMISSION_CODES } from '@machining-erp/shared'

import type { PrismaClient } from '@prisma/client'

/**
 * 角色—权限矩阵。关键差异（业务规格 3.2、2.2）：
 *  - 香港 70% 价格只有被单独授予的业务人员可见，普通业务员看不到；
 *  - 成本核算与报价修改申请处理只有报价工程师可做，业务员不可。
 */
export const ROLES = [
  {
    code: 'SYS_ADMIN',
    name: 'IT 系统管理员',
    description: '平台、权限、审批流、编号与账号管理；不代业务部门修改单据',
    permissions: [PERMISSION_CODES.IT_ACCOUNT_ADMIN],
  },
  {
    code: 'EXECUTIVE',
    name: '总经办',
    description: '经营视角只读 + 备料订单终审',
    permissions: [
      PERMISSION_CODES.STOCK_ORDER_GM_APPROVE,
      PERMISSION_CODES.ORDER_TRACKING_VIEW,
      PERMISSION_CODES.CUSTOMER_VIEW_ALL,
      PERMISSION_CODES.CUSTOMER_FINANCE_VIEW,
    ],
  },
  {
    code: 'SALES_MANAGER',
    name: '业务部主管',
    description: '业务经理：报价与订单审核，且被授予香港 70% 价格权限',
    permissions: [
      PERMISSION_CODES.HK_PRICE_VIEW,
      PERMISSION_CODES.SALES_OPERATE,
      PERMISSION_CODES.INVOICE_APPLY,
      PERMISSION_CODES.QUOTE_APPROVE,
      PERMISSION_CODES.ORDER_APPROVE,
      PERMISSION_CODES.ORDER_TRACKING_VIEW,
      PERMISSION_CODES.CUSTOMER_EDIT,
      PERMISSION_CODES.CUSTOMER_VIEW_ALL,
      PERMISSION_CODES.CUSTOMER_SENSITIVE_EDIT,
      PERMISSION_CODES.CUSTOMER_FINANCE_VIEW,
    ],
  },
  {
    code: 'SALES_REP',
    name: '业务员',
    description: '普通业务员：香港 70% 价格不可见，不能做成本核算',
    permissions: [
      PERMISSION_CODES.SALES_OPERATE,
      PERMISSION_CODES.INVOICE_APPLY,
      PERMISSION_CODES.ORDER_TRACKING_VIEW,
      PERMISSION_CODES.CUSTOMER_EDIT,
    ],
  },
  {
    code: 'QUOTE_ENGINEER',
    name: '报价工程师',
    description: '唯一可做成本核算与处理报价修改申请的角色；不做下单',
    permissions: [
      PERMISSION_CODES.COSTING_EDIT,
      PERMISSION_CODES.QUOTE_CHANGE_HANDLE,
      PERMISSION_CODES.MATERIAL_PRICE_EDIT,
    ],
  },
  {
    code: 'PMC_PLANNER',
    name: 'PMC 计划员',
    description: '生产计划与齐套；可查看订单追踪',
    permissions: [PERMISSION_CODES.ORDER_TRACKING_VIEW],
  },
] as const

export async function seedRoles(prisma: PrismaClient): Promise<void> {
  for (const role of ROLES) {
    const saved = await prisma.role.upsert({
      where: { code: role.code },
      create: { code: role.code, name: role.name, description: role.description, isSystem: true },
      update: { name: role.name, description: role.description },
    })

    const permissions = await prisma.permission.findMany({
      where: { code: { in: [...role.permissions] } },
      select: { id: true },
    })

    await prisma.rolePermission.deleteMany({ where: { roleId: saved.id } })
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: saved.id,
        permissionId: permission.id,
        grantedBy: 'SEED',
      })),
      skipDuplicates: true,
    })
  }
}
