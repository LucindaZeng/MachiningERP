import type { EcnImpactScope } from '@prisma/client'

/**
 * 影响范围四项（业务规格第 6 章「影响范围评估」）。
 *
 * 固定四项、且**四项齐了才允许送会签**——这是评估完整性的唯一判据。
 * 现实里最容易漏的恰恰是「已发货批次」：漏了它，问题件已经在客户手上，
 * 而变更单上一个字都没提。
 */
export const ECN_IMPACT_SCOPES = ['WIP', 'PURCHASED', 'FINISHED_STOCK', 'SHIPPED'] as const

export const ECN_IMPACT_SCOPE_LABEL: Record<EcnImpactScope, string> = {
  WIP: '在制工单',
  PURCHASED: '已采购物料',
  FINISHED_STOCK: '已完工库存',
  SHIPPED: '已发货批次',
}

/** 前端展示顺序即评估顺序：从最近的（在制）到最远的（已发货）。 */
export const ECN_IMPACT_SCOPE_ORDER: Record<EcnImpactScope, number> = {
  WIP: 1,
  PURCHASED: 2,
  FINISHED_STOCK: 3,
  SHIPPED: 4,
}

export function isEcnImpactScope(value: string): value is EcnImpactScope {
  return (ECN_IMPACT_SCOPES as readonly string[]).includes(value)
}

/** 评估是否齐全：四项一个都不能少。 */
export function missingImpactScopes(
  assessed: readonly EcnImpactScope[],
): EcnImpactScope[] {
  return ECN_IMPACT_SCOPES.filter((scope) => !assessed.includes(scope))
}
