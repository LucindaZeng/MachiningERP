import type { EcnProductionImpact } from '@prisma/client'

/**
 * 变更对生产的影响分类（业务规格第 6 章，新增规则）。
 *
 * 只有两档，**没有中间态**。「可能有影响」这种选项唯一的作用是让人
 * 把判断推给下一个人，而下一个人手上的信息只会更少。
 */
export const ECN_PRODUCTION_IMPACTS = ['NONE', 'IMPACTED'] as const

export const ECN_PRODUCTION_IMPACT_LABEL: Record<EcnProductionImpact, string> = {
  NONE: '对生产无影响',
  IMPACTED: '对生产有影响',
}

/**
 * **计数定义（规格第 6 章）：只要生产（车床/CNC）动了，就计入受影响数量。**
 *
 * 反面同样明确：还没上机的料**不计**——它还是原样的毛坯，换图之后照新图做即可，
 * 不构成返工。
 *
 * 这句话必须是系统里的唯一定义。「算不算」一旦各人各判，返工数量就永远对不上，
 * 而返工是要真花钱的：多算一件多一件工时，少算一件就有一件不良流到下一道。
 *
 * MES 尚未上线，因此计数是 **PMC 人工清点后录入**，谁录的、何时录的都留痕。
 */
export const AFFECTED_QTY_RULE =
  '只要生产（车床/CNC）动了，就计入受影响数量；尚未上机的料不计'

/** 前端那套小写值 ↔ 服务端枚举。界面是基线，映射在边界上做完。 */
export const PRODUCTION_IMPACT_TO_WIRE: Record<EcnProductionImpact, string> = {
  NONE: 'none',
  IMPACTED: 'impacted',
}

export const PRODUCTION_IMPACT_FROM_WIRE: Record<string, EcnProductionImpact> = {
  none: 'NONE',
  impacted: 'IMPACTED',
}

export function isEcnProductionImpact(value: string): value is EcnProductionImpact {
  return (ECN_PRODUCTION_IMPACTS as readonly string[]).includes(value)
}

/** 有影响的变更才需要清点数量与走返工；无影响的两步都跳过。 */
export function requiresProductionCount(impact: EcnProductionImpact | null): boolean {
  return impact === 'IMPACTED'
}
