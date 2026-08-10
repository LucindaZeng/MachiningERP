import { PERMISSION_CODES } from '@machining-erp/shared'

import type { PrismaClient } from '@prisma/client'

export const PERMISSIONS = [
  { code: PERMISSION_CODES.COSTING_EDIT, name: '成本核算（建立/修改成本分析）', category: 'quote', description: '仅报价工程师' },
  { code: PERMISSION_CODES.QUOTE_CHANGE_HANDLE, name: '处理报价单修改申请', category: 'quote', description: '改成本分析或驳回（驳回必填理由）' },
  { code: PERMISSION_CODES.QUOTE_APPROVE, name: '报价单审核', category: 'quote', description: '业务经理' },
  { code: PERMISSION_CODES.MATERIAL_PRICE_EDIT, name: '原材料价格表与当日汇率维护', category: 'quote', description: null },
  { code: PERMISSION_CODES.SALES_OPERATE, name: '业务操作（报价申请/下单/出货）', category: 'sales', description: null },
  { code: PERMISSION_CODES.INVOICE_APPLY, name: '发票申请提交', category: 'sales', description: null },
  { code: PERMISSION_CODES.CUSTOMER_EDIT, name: '客户建档与常规维护', category: 'sales', description: null },
  { code: PERMISSION_CODES.CUSTOMER_SENSITIVE_EDIT, name: '客户敏感字段变更审批', category: 'sales', description: '银行账号、付款条件等；不得审批自己提交的申请' },
  { code: PERMISSION_CODES.CUSTOMER_VIEW_ALL, name: '查看全部客户', category: 'sales', description: '未授予者只看得到自己负责的客户' },
  { code: PERMISSION_CODES.CUSTOMER_FINANCE_VIEW, name: '客户财务字段明文查看', category: 'finance', description: '未授予者税号与银行账号只显示后 4 位' },
  { code: PERMISSION_CODES.ORDER_APPROVE, name: '订单审核', category: 'order', description: '业务经理' },
  { code: PERMISSION_CODES.STOCK_ORDER_GM_APPROVE, name: '备料订单总经办审批', category: 'order', description: '无论金额大小必须经总经办批准' },
  { code: PERMISSION_CODES.ORDER_TRACKING_VIEW, name: '订单追踪查看', category: 'order', description: '业务部 / 总经办 / PMC 三方可见' },
  { code: PERMISSION_CODES.QUALITY_RMA_JUDGE, name: '客诉责任归属判定与 8D', category: 'quality', description: '业务登记客诉、品质判定责任；登记人不得自判' },
  { code: PERMISSION_CODES.IT_ACCOUNT_ADMIN, name: 'IT 账号管理', category: 'system', description: '账户申请审批、密码重置' },
] as const

export async function seedPermissions(prisma: PrismaClient): Promise<void> {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      create: { ...permission },
      update: { name: permission.name, category: permission.category, description: permission.description },
    })
  }
}
