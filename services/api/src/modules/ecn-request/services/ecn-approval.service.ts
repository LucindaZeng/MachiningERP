import { ECN_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { ECN_CHANGE_TYPE_LABEL } from '../constants/ecn-change-types'
import { ECN_SIGNOFF_DEPARTMENTS, PROXY_SIGNOFF_NOTE } from '../constants/ecn-signoff'
import { ECN_DOC_TYPE } from '../constants/ecn-timeline'
import {
  ECN_REPOSITORY,
  type EcnRepositoryPort,
  type EcnRequestRecord,
} from '../repositories/ecn.repository.port'

import { EcnImpactService } from './ecn-impact.service'
import { EcnRequestService, type EcnActor } from './ecn-request.service'
import { assertRejectReason, assertReleasable } from './ecn-scope.rules'

/** 通知分类。与 shipment / customs 等模块一样是自由字符串，取值集中在这里。 */
const NOTIFY_CATEGORY = 'ECN_REQUEST'

/**
 * 会签、批准、驳回与执行（ECN-03 ~ ECN-05）。
 *
 * 两条不可让步的规矩：
 * 1. **批准前置**必须过——改图未同步工艺路线、改工序未指定生效批次，一律拦下。
 *    这两条不是形式：前者会让车间按新图做旧工艺，后者会把已投产批次无声地改掉。
 * 2. **驳回必须填中文理由**，且理由随通知一起送到业务员手上。
 *    只告诉人「没过」，换来的是同一张单换个说法再提一次。
 */
@Injectable()
export class EcnApprovalService {
  constructor(
    private readonly requests: EcnRequestService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    @Inject(ECN_REPOSITORY) private readonly repository: EcnRepositoryPort,
  ) {}

  /**
   * 记录跨部门会签。
   *
   * ⚠️ 五个部门的模块都还没上线，现阶段由工程岗**代签**，每条都标 `proxied`
   * 并写明代签说明——审计里必须一眼看出「这不是 PMC 自己签的」。
   * 各部门模块上线时只换签收人来源，状态机与端点契约不动。
   */
  async recordSignoffs(
    id: string,
    versionLock: number,
    opinion: string | null,
    actor: EcnActor,
  ): Promise<EcnRequestRecord> {
    EcnImpactService.assertEngineer(actor)
    const signedAt = new Date()

    const updated = await this.repository.recordSignoffs(
      id,
      versionLock,
      ECN_SIGNOFF_DEPARTMENTS.map((department) => ({
        department,
        signedBy: actor.userCode,
        signedAt,
        opinion: opinion ?? PROXY_SIGNOFF_NOTE,
        proxied: true,
      })),
      actor.userCode,
    )
    if (!updated) throw new BizError(ECN_ERRORS.NOT_EDITABLE)

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'ecn.signoff',
      entityType: ECN_DOC_TYPE,
      entityId: updated.docNo,
      after: { departments: ECN_SIGNOFF_DEPARTMENTS, proxied: true },
    })

    return updated
  }

  /**
   * 批准发布（ECN-04）。
   *
   * 顺序：判会签 → 判发布前置 → 迁状态 → 通知。前置没过就迁状态，
   * 等于把一份不能执行的变更标成已批准，车间照着做的就是它。
   */
  async approve(id: string, versionLock: number, actor: EcnActor): Promise<EcnRequestRecord> {
    EcnImpactService.assertEngineer(actor)
    const current = await this.requests.load(id)

    assertSignoffComplete(current)
    assertReleasable({
      changeType: current.changeType,
      routingUpdated: current.routingUpdated,
      effectiveBatch: current.effectiveBatch,
    })

    const approved = await this.requests.advance({ ...current, versionLock }, 'APPROVED', actor, {
      approvedBy: actor.userCode,
      approvedAt: new Date(),
    })

    await this.notifyOwner(approved, '工程变更已批准', approvalBody(approved))
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'ecn.approve',
      entityType: ECN_DOC_TYPE,
      entityId: approved.docNo,
      after: {
        changeType: approved.changeType,
        newDrawingVersionId: approved.newDrawingVersionId,
        needRequote: approved.needRequote,
        needOrderReapproval: approved.needOrderReapproval,
      },
    })

    return approved
  }

  /** 驳回。理由必填，且原样带进通知——被驳回的人要知道该改什么。 */
  async reject(
    id: string,
    versionLock: number,
    reason: string | null,
    actor: EcnActor,
  ): Promise<EcnRequestRecord> {
    EcnImpactService.assertEngineer(actor)
    const trimmed = assertRejectReason(reason)
    const current = await this.requests.load(id)

    const rejected = await this.requests.advance({ ...current, versionLock }, 'REJECTED', actor, {
      rejectReason: trimmed,
    })

    await this.notifyOwner(rejected, '工程变更已驳回', `驳回理由：${trimmed}`)
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'ecn.reject',
      entityType: ECN_DOC_TYPE,
      entityId: rejected.docNo,
      after: { reason: trimmed },
    })

    return rejected
  }

  /** 转入执行与批次切换（ECN-05）。 */
  async startExecution(
    id: string,
    versionLock: number,
    actor: EcnActor,
  ): Promise<EcnRequestRecord> {
    EcnImpactService.assertEngineer(actor)
    const current = await this.requests.load(id)
    return this.requests.advance({ ...current, versionLock }, 'EXECUTING', actor, {})
  }

  async close(id: string, versionLock: number, actor: EcnActor): Promise<EcnRequestRecord> {
    EcnImpactService.assertEngineer(actor)
    const current = await this.requests.load(id)

    const closed = await this.requests.advance({ ...current, versionLock }, 'CLOSED', actor, {
      closedAt: new Date(),
    })
    await this.notifyOwner(closed, '工程变更已结案', `${closed.docNo} 的变更已执行完毕并结案`)
    return closed
  }

  /** 无论批准还是驳回都通知发起的业务员——他要对客户回话。 */
  private async notifyOwner(
    record: EcnRequestRecord,
    title: string,
    body: string,
  ): Promise<void> {
    await this.notifications.notify({
      recipientUserCode: record.ownerUserCode,
      category: NOTIFY_CATEGORY,
      title: `${title}：${record.docNo}`,
      body,
      docType: ECN_DOC_TYPE,
      docId: record.id,
    })
  }
}

/** 会签方一个都不能少。缺谁就报谁，别让人自己去数。 */
export function assertSignoffComplete(record: EcnRequestRecord): void {
  const signed = record.signoffs.filter((item) => item.signedAt !== null).map((item) => item.department)
  const missing = ECN_SIGNOFF_DEPARTMENTS.filter((department) => !signed.includes(department))
  if (missing.length === 0) return

  throw new BizError(ECN_ERRORS.SIGNOFF_NOT_COMPLETE, {
    message: `尚未会签的部门：${missing.join('、')}`,
    details: { missing },
  })
}

/**
 * 批准通知的正文。
 *
 * 把两个下游动作**写进通知**而不是替业务去建单：重新核价要填成本变化、
 * 订单修改要填改什么，这些信息 ECN 里没有，代建只会产出一批空壳单据等人来补。
 */
function approvalBody(record: EcnRequestRecord): string {
  const parts = [
    `${ECN_CHANGE_TYPE_LABEL[record.changeType]}变更已批准发布`,
    record.effectiveBatch ? `生效批次：${record.effectiveBatch}` : null,
    record.needRequote ? '⚠️ 需重新核价：请到「报价管理 → 报价单修改申请」发起' : null,
    record.needOrderReapproval ? '⚠️ 需订单重审：请到「订单管理 → 订单修改申请」发起' : null,
  ]
  return parts.filter((part): part is string => part !== null).join('；')
}
