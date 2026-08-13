import { ECN_ERRORS } from '@machining-erp/shared'

import { BizError } from '../../../common/errors/biz-error'
import { requiresProductionCount } from '../constants/ecn-production-impact'

import type { EcnProductionImpact } from '@prisma/client'

/**
 * 生产影响分类相关的三道闸门，**全部是纯函数**（业务规格第 6 章，新增规则）。
 *
 * 与 ecn-scope.rules 分文件：那支管的是「这张单该不该受理、能不能发布」，
 * 这支管的是「有影响的变更，生产那一侧的活干完了没有」。两件事的触发时机
 * 与责任人都不同，混在一支里读的人得先分辨每条属于哪一半。
 */

/**
 * 送会签前必须已分类。
 *
 * 这是本轮规则的核心闸门：分类决定了后面要不要清点已投产数量、要不要走返工。
 * 不填就放行，等于把这两件事一起悄悄跳过——而跳过的后果要到车间才发现。
 */
export function assertProductionImpactClassified(
  impact: EcnProductionImpact | null,
): EcnProductionImpact {
  if (impact === null) throw new BizError(ECN_ERRORS.PRODUCTION_IMPACT_REQUIRED)
  return impact
}

/**
 * 受影响数量还能不能改。
 *
 * 返工一经发起即锁死：返工工单是按这个数拆的，事后改数会让车间手上的工单
 * 与系统里的数对不上，而对不上的那一刻没有人会收到通知。
 */
export function assertQuantityEntryEditable(reworkInitiatedAt: Date | null): void {
  if (reworkInitiatedAt !== null) throw new BizError(ECN_ERRORS.AFFECTED_QTY_LOCKED)
}

/** 发起返工的前置：必须已分类为「有影响」、已录入数量、且尚未发起过。 */
export function assertReworkInitiable(facts: {
  productionImpact: EcnProductionImpact | null
  affectedLineCount: number
  reworkInitiatedAt: Date | null
}): void {
  if (!requiresProductionCount(facts.productionImpact)) {
    throw new BizError(ECN_ERRORS.PRODUCTION_IMPACT_REQUIRED, {
      message: '仅「对生产有影响」的变更需要发起返工',
    })
  }
  if (facts.reworkInitiatedAt !== null) throw new BizError(ECN_ERRORS.REWORK_ALREADY_INITIATED)
  if (facts.affectedLineCount === 0) throw new BizError(ECN_ERRORS.AFFECTED_QTY_REQUIRED)
}

/**
 * 结案闸门。
 *
 * **「无影响」的变更两步都跳过**——它本来就没有已投产的东西要处理，
 * 强行要求它录一个 0 只会制造一堆没有意义的记录，还会让真正需要清点的那些
 * 混在里面看不出来。
 */
export function assertClosable(facts: {
  productionImpact: EcnProductionImpact | null
  affectedLineCount: number
  reworkInitiatedAt: Date | null
}): void {
  if (!requiresProductionCount(facts.productionImpact)) return

  if (facts.affectedLineCount === 0) throw new BizError(ECN_ERRORS.AFFECTED_QTY_REQUIRED)
  if (facts.reworkInitiatedAt === null) throw new BizError(ECN_ERRORS.REWORK_NOT_INITIATED)
}
