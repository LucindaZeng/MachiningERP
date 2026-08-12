import { PERMISSION_CODES } from '@machining-erp/shared'

import type { PrismaClient } from '@prisma/client'

/**
 * 角色—权限矩阵。关键差异（业务规格 3.2、2.2）：
 *  - 客户财务字段与敏感字段审批只有被单独授予的业务主管可做，普通业务员不可；
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
      PERMISSION_CODES.ORDER_CROSS_REVIEW,
      PERMISSION_CODES.ORDER_TRACKING_VIEW,
      PERMISSION_CODES.CUSTOMER_VIEW_ALL,
      PERMISSION_CODES.CUSTOMER_FINANCE_VIEW,
    ],
  },
  {
    code: 'SALES_MANAGER',
    name: '业务部主管',
    description: '业务经理：报价与订单审核，且被授予客户敏感字段与财务字段权限',
    permissions: [
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
    description: '普通业务员：客户财务字段不可见，不能做成本核算',
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
    code: 'ENGINEER',
    name: '工程部工程师',
    description: '接收 BOM 申请、建立 BOM 与工艺路线、回传 BOM 与程序双状态',
    permissions: [PERMISSION_CODES.ENGINEERING_BOM_HANDLE, PERMISSION_CODES.ORDER_TRACKING_VIEW],
  },
  {
    code: 'FINANCE_REVIEWER',
    name: '财务审核员',
    description: '订单审核链第二节：资金占用与付款条件审核；备料订单同样先过财务再上总经办',
    permissions: [
      PERMISSION_CODES.ORDER_FINANCE_REVIEW,
      PERMISSION_CODES.CUSTOMER_FINANCE_VIEW,
      PERMISSION_CODES.ORDER_TRACKING_VIEW,
    ],
  },
  {
    code: 'CUSTOMS_BROKER',
    name: '关务岗',
    description: '报关要素复核、申报与回执归档；业务建档、关务复核，两者不得由同一人完成',
    permissions: [PERMISSION_CODES.CUSTOMS_DECLARE, PERMISSION_CODES.ORDER_TRACKING_VIEW],
  },
  {
    code: 'QUALITY_ENGINEER',
    name: '品质工程师',
    description: '客诉责任归属判定、8D 关闭；业务登记、品质判定，两者不得由同一人完成',
    permissions: [PERMISSION_CODES.QUALITY_RMA_JUDGE, PERMISSION_CODES.ORDER_TRACKING_VIEW],
  },
  {
    code: 'PMC_PLANNER',
    name: 'PMC 计划员',
    description: '生产计划与齐套；参与跨部门订单评审，可查看订单追踪',
    permissions: [PERMISSION_CODES.ORDER_TRACKING_VIEW, PERMISSION_CODES.ORDER_CROSS_REVIEW],
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
