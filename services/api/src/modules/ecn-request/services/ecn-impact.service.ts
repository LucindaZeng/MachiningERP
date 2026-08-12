import { ECN_ERRORS, PERMISSION_CODES } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { isEcnImpactScope } from '../constants/ecn-impact-scopes'
import { ECN_DOC_TYPE } from '../constants/ecn-timeline'
import {
  ECN_REPOSITORY,
  type EcnImpactDraft,
  type EcnRepositoryPort,
  type EcnRequestRecord,
} from '../repositories/ecn.repository.port'

import { EcnRequestService, type EcnActor } from './ecn-request.service'
import { assertImpactsAssessed } from './ecn-scope.rules'

/** 一条影响评估的入参。金额可空——评不出钱与评出零是两回事。 */
export interface ImpactInput {
  scope: string
  quantity: string
  amountMinor: string | null
  note: string
}

export interface AssessImpactInput {
  impacts: readonly ImpactInput[]
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

    const impacts = toDrafts(input.impacts)
    const saved = await this.repository.replaceImpacts(id, versionLock, impacts, actor.userCode)
    if (!saved) throw new BizError(ECN_ERRORS.NOT_EDITABLE)

    const patched = await this.repository.patch(id, saved.versionLock, {
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

    return this.requests.advance({ ...current, versionLock }, 'REVIEWING', actor, {})
  }
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
