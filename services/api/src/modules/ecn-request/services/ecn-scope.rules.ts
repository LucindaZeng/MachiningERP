import { ECN_ERRORS } from '@machining-erp/shared'

import { BizError } from '../../../common/errors/biz-error'
import {
  requiresEffectiveBatch,
  requiresNewDrawing,
  requiresRoutingSync,
} from '../constants/ecn-change-types'
import { ECN_IMPACT_SCOPE_LABEL, missingImpactScopes } from '../constants/ecn-impact-scopes'

import type { EcnChangeType, EcnImpactScope, SalesOrderType } from '@prisma/client'

/**
 * ECN 的四道闸门，**全部是纯函数**（业务规格第 6 章）。
 *
 * 单独成文件而不是散在 service 里，是因为这四条恰恰是这个模块的全部业务价值：
 * 别的部分都是取数与状态迁移，而「该不该受理、能不能批」全在这里。
 * 纯函数才测得动每一条分支——DoD 要求的 ≥90% 分支覆盖压在这支文件上。
 *
 * 四道闸门按发生顺序：
 * 1. **受理范围**（提交时）——见 constants/ecn-change-types.ts 的 `assertEcnChangeType`；
 * 2. **样品阶段重定向**（提交时）——本文件；
 * 3. **评估齐套**（送会签时）——本文件；
 * 4. **发布前置**（批准时）：改图必须已同步工艺路线、改工序必须指定生效批次——本文件。
 */

/** 判定样品阶段所需的订单事实。取不到订单时传 null。 */
export interface EcnOrderFacts {
  orderType: SalesOrderType
  docNo: string
}

/**
 * 样品阶段的产品变更走报价变更（业务规格 4.3）。
 *
 * 判据取**关联订单的 orderType = SAMPLE**：这是库里唯一含义明确、可审计的字段。
 * 未关联订单的 ECN（内部发起的工艺改善常常没有订单）无从判定，一律放行，
 * 由工程在评估环节人工把关——宁可放过也不误拦，因为误拦的那张单
 * 会被换个说法重新提上来，反而绕过了这条规则。
 */
export function assertNotSampleStage(order: EcnOrderFacts | null): void {
  if (order === null || order.orderType !== 'SAMPLE') return

  throw new BizError(ECN_ERRORS.SAMPLE_STAGE_REDIRECT, {
    message:
      `关联订单 ${order.docNo} 是样品订单，样品阶段的产品变更请走` +
      '「报价管理 → 报价单修改申请（QRC）」（业务规格 4.3），由报价工程师重新核价',
    details: { orderDocNo: order.docNo, orderType: order.orderType },
  })
}

/** 改图必须给出新版图纸——否则「变更后」只是一句没有依据的描述。 */
export function assertNewDrawingProvided(
  changeType: EcnChangeType,
  newDrawingVersionId: string | null,
): void {
  if (!requiresNewDrawing(changeType)) return
  if (newDrawingVersionId) return

  throw new BizError(ECN_ERRORS.NEW_DRAWING_REQUIRED)
}

/**
 * 送会签前，四项影响必须评全。
 *
 * 一次列出**所有**缺项，不做「补一项报一项」——与报关齐套闸门同一套待人方式。
 */
export function assertImpactsAssessed(assessed: readonly EcnImpactScope[]): void {
  const missing = missingImpactScopes(assessed)
  if (missing.length === 0) return

  throw new BizError(ECN_ERRORS.IMPACT_ASSESSMENT_REQUIRED, {
    message: `影响评估尚缺：${missing.map((scope) => ECN_IMPACT_SCOPE_LABEL[scope]).join('、')}`,
    details: { missing },
  })
}

/** 批准前置事实。 */
export interface EcnReleaseFacts {
  changeType: EcnChangeType
  routingUpdated: boolean
  effectiveBatch: string | null
}

/**
 * 批准发布的两道前置。
 *
 * 一次判完两条并合并报错，因为它们都是「发布前必须补齐的东西」——
 * 分两次报，用户补完第一条才发现还有第二条。
 */
export function assertReleasable(facts: EcnReleaseFacts): void {
  if (requiresRoutingSync(facts.changeType) && !facts.routingUpdated) {
    throw new BizError(ECN_ERRORS.ROUTING_NOT_SYNCED)
  }

  if (requiresEffectiveBatch(facts.changeType) && !facts.effectiveBatch) {
    throw new BizError(ECN_ERRORS.EFFECTIVE_BATCH_REQUIRED)
  }
}

/** 驳回必须填中文理由——被驳回的人要知道该改什么，而不是只知道「没过」。 */
export function assertRejectReason(reason: string | null | undefined): string {
  const trimmed = (reason ?? '').trim()
  if (trimmed.length === 0) throw new BizError(ECN_ERRORS.REJECT_REASON_REQUIRED)
  return trimmed
}

/**
 * 下游联动标志的推导边界。
 *
 * **不推导**——两个标志由工程在评估时人工判定。理由：「改了材料会不会影响价格」
 * 真正的判断依据在成本模块，而它尚未上线；现在按类型硬推等于拍脑袋，
 * 而拍出来的结果会以「系统说要重新报价」的名义被当成事实。
 * 这里只提供一个**建议**，供界面提示，最终值仍以人填的为准。
 */
export function suggestNeedRequote(changeType: EcnChangeType): boolean {
  return changeType === 'MATERIAL' || changeType === 'SURFACE'
}
