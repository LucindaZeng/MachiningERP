import { PERMISSION_CODES } from '@machining-erp/shared'

import type { SalesOrderStatus } from '@prisma/client'

/**
 * 每个审核节点各自要求的权限点。
 *
 * 做成一张表而不是在 service 里逐个 if：审核链本身已经是数据驱动的，
 * 权限也跟着数据走，加一道审批时两处一起改，不会出现「链上多了一节但谁都能批」。
 *
 * 键是**离开该状态所需的权限**——处在 FINANCE_REVIEW 的单子要财务权限才能推进。
 */
export const REVIEW_PERMISSIONS: Partial<Record<SalesOrderStatus, string>> = {
  MANAGER_REVIEW: PERMISSION_CODES.ORDER_APPROVE,
  FINANCE_REVIEW: PERMISSION_CODES.ORDER_FINANCE_REVIEW,
  /** 备料订单专属：无论金额大小都要总经办 */
  GM_REVIEW: PERMISSION_CODES.STOCK_ORDER_GM_APPROVE,
  CROSS_REVIEW: PERMISSION_CODES.ORDER_CROSS_REVIEW,
}

export function permissionForReview(status: SalesOrderStatus): string | null {
  return REVIEW_PERMISSIONS[status] ?? null
}
