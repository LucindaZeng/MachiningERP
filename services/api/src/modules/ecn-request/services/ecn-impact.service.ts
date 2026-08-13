import { ECN_ERRORS, PERMISSION_CODES } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { UserDirectoryService } from '../../identity'
import { isEcnImpactScope } from '../constants/ecn-impact-scopes'
import {
  ECN_PRODUCTION_IMPACT_LABEL,
  PRODUCTION_IMPACT_FROM_WIRE,
  isEcnProductionImpact,
  requiresProductionCount,
} from '../constants/ecn-production-impact'
import { ECN_DOC_TYPE } from '../constants/ecn-timeline'
import {
  ECN_REPOSITORY,
  type EcnImpactDraft,
  type EcnRepositoryPort,
  type EcnRequestRecord,
} from '../repositories/ecn.repository.port'

import { assertProductionImpactClassified } from './ecn-production.rules'
import { EcnRequestService, type EcnActor } from './ecn-request.service'
import { assertImpactsAssessed } from './ecn-scope.rules'

import type { EcnProductionImpact } from '@prisma/client'

/** 一条影响评估的入参。金额可空——评不出钱与评出零是两回事。 */
export interface ImpactInput {
  scope: string
  quantity: string
  amountMinor: string | null
  note: string
}

export interface AssessImpactInput {
  impacts: readonly ImpactInput[]
  /**
   * 对生产有无影响（规格第 6 章新增规则）。**必填**——
   * 它决定了后面要不要清点已投产数量、要不要走返工。
   * 接受前端那套小写值（none / impacted）或服务端枚举。
   */
  productionImpact: string
  /** 改图是否已同步更新工艺路线（第 6 章硬规则，批准时会再查一次） */
  routingUpdated: boolean
  /** 改工序的生效批次版本 */
  effectiveBatch: string | null
  /** 是否需要重新核价 / 订单重审——由工程判定，系统不代猜（见 ecn-scope.rules 的说明） */
  needRequote: boolean
  needOrderReapproval: boolean
}

/**
 * 工程影响评估（ECN-02）。
 *
 * 四项影响**整表提交**而不是逐条追加：评估是一次判断，
 * 逐条追加会让「还差哪几项」变成一个要靠人记的状态，而那正是最容易漏掉
 * 「已发货批次」的地方——漏了它，问题件已经在客户手上，单子上一个字没提。
 */
@Injectable()
export class EcnImpactService {
  constructor(
    private readonly requests: EcnRequestService,
    private readonly notifications: NotificationService,
    private readonly users: UserDirectoryService,
    private readonly audit: AuditService,
    @Inject(ECN_REPOSITORY) private readonly repository: EcnRepositoryPort,
  ) {}

  static assertEngineer(actor: EcnActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.QUOTE_APPROVE)) {
      throw new BizError(ECN_ERRORS.ENGINEER_ROLE_REQUIRED)
    }
  }

  /**
   * 保存评估结果。可以反复保存——评估过程中补数据是常态，
   * 真正的门槛在下一步「送会签」，那里才要求四项齐全。
   */
  async assess(
    id: string,
    versionLock: number,
    input: AssessImpactInput,
    actor: EcnActor,
  ): Promise<EcnRequestRecord> {
    EcnImpactService.assertEngineer(actor)
    const current = await this.requests.load(id)

    const productionImpact = toProductionImpact(input.productionImpact)
    const impacts = toDrafts(input.impacts)
    const saved = await this.repository.replaceImpacts(id, versionLock, impacts, actor.userCode)
    if (!saved) throw new BizError(ECN_ERRORS.NOT_EDITABLE)

    const patched = await this.repository.patch(id, saved.versionLock, {
      productionImpact,
      routingUpdated: input.routingUpdated,
      effectiveBatch: input.effectiveBatch,
      needRequote: input.needRequote,
      needOrderReapproval: input.needOrderReapproval,
      assessedBy: actor.userCode,
      assessedAt: new Date(),
      updatedBy: actor.userCode,
    })
    if (!patched) throw new BizError(ECN_ERRORS.NOT_EDITABLE)

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'ecn.assess',
      entityType: ECN_DOC_TYPE,
      entityId: patched.docNo,
      before: { status: current.status, impactCount: current.impacts.length },
      after: {
        impactCount: impacts.length,
        productionImpact,
        routingUpdated: input.routingUpdated,
        needRequote: input.needRequote,
        needOrderReapproval: input.needOrderReapproval,
      },
    })

    return patched
  }

  /**
   * 送跨部门会签（ECN-03）。四项影响必须评全——这是评估完整性的唯一判据。
   */
  async submitForSignoff(
    id: string,
    versionLock: number,
    actor: EcnActor,
  ): Promise<EcnRequestRecord> {
    EcnImpactService.assertEngineer(actor)
    const current = await this.requests.load(id)

    assertImpactsAssessed(current.impacts.map((impact) => impact.scope))
    // 新增闸门：未判定「对生产有无影响」不得往下走
    const productionImpact = assertProductionImpactClassified(current.productionImpact)

    const advanced = await this.requests.advance({ ...current, versionLock }, 'REVIEWING', actor, {})
    if (requiresProductionCount(productionImpact)) {
      await this.notifyPmc(advanced)
    }
    return advanced
  }

  /**
   * 判为「对生产有影响」时叫 PMC 来清点。
   *
   * 收件人取 `order.tracking.view` 的持有者——PMC 现有的 ECN 可见性就挂在它上面。
   * ⚠️ 业务部与总经办同样持有该权限，因此这条通知目前会**多发给他们**；
   * 标题里点名 PMC 以降低误认，根治要等 PMC 专属权限点（见完成报告 TODO）。
   */
  private async notifyPmc(record: EcnRequestRecord): Promise<void> {
    const recipients = await this.users.listUserCodesByPermission(
      PERMISSION_CODES.ORDER_TRACKING_VIEW,
    )
    if (recipients.length === 0) return

    await this.notifications.notifyMany(recipients, {
      category: 'ECN_REQUEST',
      title: `【PMC 待清点】${record.docNo} 对生产有影响`,
      body:
        `${record.productName}（${record.drawingNo}）的变更判为「` +
        `${ECN_PRODUCTION_IMPACT_LABEL.IMPACTED}」，请清点并录入已投产数量。` +
        '计数口径：只要生产（车床/CNC）动了就计入，尚未上机的料不计。',
      docType: ECN_DOC_TYPE,
      docId: record.id,
    })
  }
}

/** 入参 → 枚举。接受前端小写值与服务端枚举两种写法；都不认就是没判定。 */
function toProductionImpact(value: string): EcnProductionImpact {
  const normalized = PRODUCTION_IMPACT_FROM_WIRE[value] ?? value
  if (!isEcnProductionImpact(normalized)) {
    throw new BizError(ECN_ERRORS.PRODUCTION_IMPACT_REQUIRED, {
      message: `无法识别的生产影响分类「${value}」；只接受「无影响」或「有影响」`,
    })
  }
  return normalized
}

/**
 * 入参 → 落库形状。
 *
 * 两件事在这里做完：范围值校验（未知范围直接拒），以及同一范围只能出现一次——
 * 重复的「在制工单」会让「四项评全了没有」这个判断失效。
 */
function toDrafts(impacts: readonly ImpactInput[]): EcnImpactDraft[] {
  const seen = new Set<string>()

  return impacts.map((impact) => {
    if (!isEcnImpactScope(impact.scope)) {
      throw new BizError(ECN_ERRORS.IMPACT_ASSESSMENT_REQUIRED, {
        message: `未知的影响范围「${impact.scope}」`,
      })
    }
    if (seen.has(impact.scope)) throw new BizError(ECN_ERRORS.IMPACT_SCOPE_DUPLICATED)
    seen.add(impact.scope)

    return {
      scope: impact.scope,
      quantity: impact.quantity,
      // 空字符串与 null 都表示「算不出钱」，不落成 0
      amountMinor:
        impact.amountMinor === null || impact.amountMinor.trim() === ''
          ? null
          : BigInt(impact.amountMinor),
      note: impact.note,
    }
  })
}
