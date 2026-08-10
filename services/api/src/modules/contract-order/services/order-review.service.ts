import { ORDER_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DOC_TYPES } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import {
  firstReviewStatus,
  isReviewStatus,
  nextReviewStatus,
  stateMachineOf,
} from '../constants/order-states'
import { permissionForReview } from '../constants/review-permissions'
import {
  SALES_ORDER_REPOSITORY,
  type SalesOrderRecord,
  type SalesOrderRepositoryPort,
  type SalesOrderStatusPatch,
} from '../repositories/sales-order.repository.port'

import { SalesOrderService, type OrderActor, type OrderContext } from './sales-order.service'

/** 各审核节点的责任部门，用于节点计时与待办 */
const REVIEW_OWNER_DEPT: Record<string, string> = {
  MANAGER_REVIEW: '业务部',
  FINANCE_REVIEW: '财务部',
  GM_REVIEW: '总经办',
  CROSS_REVIEW: '业务部',
}

const REVIEW_LABEL: Record<string, string> = {
  MANAGER_REVIEW: '业务经理审核',
  FINANCE_REVIEW: '财务审核',
  GM_REVIEW: '总经办审批',
  CROSS_REVIEW: '跨部门订单评审',
}

/**
 * 订单送审与审核链推进（业务规格 4.1、4.5）。
 *
 * 链本身是数据（`REVIEW_CHAIN`），这里只负责「往前推一格」：
 * 每一格各自要求哪个权限点由 `REVIEW_PERMISSIONS` 决定，因此备料订单
 * 多出来的总经办那一节不需要在这里写任何 if。
 */
@Injectable()
export class OrderReviewService {
  constructor(
    private readonly orders: SalesOrderService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly timeline: DocTimelineService,
    @Inject(SALES_ORDER_REPOSITORY) private readonly repository: SalesOrderRepositoryPort,
  ) {}

  /** 送审：T0 从这一刻起算，用于统计各审核节点耗时。 */
  async submit(
    id: string,
    versionLock: number,
    context: OrderContext,
    actor: OrderActor,
  ): Promise<SalesOrderRecord> {
    SalesOrderService.assertSales(actor)
    const current = await this.orders.load(id)

    const target = firstReviewStatus(current.orderType)
    stateMachineOf(current.orderType).assert(current.status, target)
    // 建单到提交之间报价可能被改版、BOM 可能被退回，所以再跑一次同一套校验
    SalesOrderService.assertPrerequisites({ ...current, lines: current.lines }, context)

    const now = new Date()
    const updated = await this.transition(id, versionLock, {
      status: target,
      submittedAt: now,
      submittedBy: actor.userCode,
      rejectReason: null,
      updatedBy: actor.userCode,
    })

    await this.enterReviewNode(current, target, now)
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'sales-order.submit',
      entityType: 'SalesOrder',
      entityId: current.docNo,
      after: { status: target, t0: now.toISOString() },
    })

    return updated
  }

  /**
   * 通过当前节点，推进到下一节。
   * 走到链尾即 APPROVED，此时订单可以排产。
   */
  async approve(id: string, versionLock: number, actor: OrderActor): Promise<SalesOrderRecord> {
    const current = await this.orders.load(id)
    this.assertReviewer(current, actor)

    const target = nextReviewStatus(current.status, current.orderType)
    if (!target) throw new BizError(ORDER_ERRORS.ORDER_NOT_EDITABLE, { message: '该订单不在审核链上' })
    stateMachineOf(current.orderType).assert(current.status, target)

    const now = new Date()
    const updated = await this.transition(id, versionLock, {
      status: target,
      approvedAt: target === 'APPROVED' ? now : null,
      updatedBy: actor.userCode,
    })

    if (target === 'APPROVED') {
      await this.timeline.close(DOC_TYPES.SALES_ORDER, id, 'DONE', now)
      await this.notifyOwner(current, `订单已批准：${current.docNo}`, '全部审核节点已通过，可以排产。')
    } else {
      await this.enterReviewNode(current, target, now)
    }

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'sales-order.approve',
      entityType: 'SalesOrder',
      entityId: current.docNo,
      before: { status: current.status },
      after: { status: target },
    })

    return updated
  }

  /** 驳回：退回草稿，理由必填并回到业务员工作台。 */
  async reject(
    id: string,
    versionLock: number,
    reason: string,
    actor: OrderActor,
  ): Promise<SalesOrderRecord> {
    const trimmed = reason.trim()
    if (!trimmed) throw new BizError(ORDER_ERRORS.CHANGE_REJECT_REASON_REQUIRED)

    const current = await this.orders.load(id)
    this.assertReviewer(current, actor)
    stateMachineOf(current.orderType).assert(current.status, 'DRAFT')

    const updated = await this.transition(id, versionLock, {
      status: 'DRAFT',
      rejectReason: trimmed,
      approvedAt: null,
      updatedBy: actor.userCode,
    })

    await this.timeline.enter({
      docType: DOC_TYPES.SALES_ORDER,
      docId: id,
      node: '订单编制',
      ownerUserCode: current.submittedBy,
      ownerDept: '业务部',
      previousStatus: 'ABNORMAL',
    })
    await this.notifyOwner(current, `订单被驳回：${current.docNo}`, `驳回理由：${trimmed}`)

    return updated
  }

  /** 当前节点要求的权限点由表决定，服务里不写 if 判角色。 */
  private assertReviewer(order: SalesOrderRecord, actor: OrderActor): void {
    if (!isReviewStatus(order.status, order.orderType)) {
      throw new BizError(ORDER_ERRORS.ORDER_NOT_EDITABLE, { message: '该订单当前不在审核节点上' })
    }

    const required = permissionForReview(order.status)
    if (required && !actor.permissions.includes(required)) {
      const definition =
        order.status === 'GM_REVIEW'
          ? ORDER_ERRORS.GM_APPROVAL_REQUIRED
          : ORDER_ERRORS.APPROVE_ROLE_REQUIRED
      throw new BizError(definition, {
        message: `${REVIEW_LABEL[order.status] ?? order.status}需要「${required}」权限`,
      })
    }
  }

  private async enterReviewNode(
    order: SalesOrderRecord,
    status: string,
    at: Date,
  ): Promise<void> {
    await this.timeline.enter({
      docType: DOC_TYPES.SALES_ORDER,
      docId: order.id,
      node: REVIEW_LABEL[status] ?? status,
      ownerDept: REVIEW_OWNER_DEPT[status] ?? '业务部',
      at,
    })
  }

  private async transition(
    id: string,
    versionLock: number,
    patch: SalesOrderStatusPatch,
  ): Promise<SalesOrderRecord> {
    const updated = await this.repository.updateStatus(id, versionLock, patch)
    if (!updated) throw new BizError(ORDER_ERRORS.ORDER_NOT_EDITABLE)
    return updated
  }

  private notifyOwner(order: SalesOrderRecord, title: string, body: string): Promise<unknown> {
    const recipient = order.submittedBy ?? order.createdBy
    if (!recipient) return Promise.resolve(null)

    return this.notifications.notify({
      recipientUserCode: recipient,
      category: 'SALES_ORDER_REVIEW',
      title,
      body,
      docType: DOC_TYPES.SALES_ORDER,
      docId: order.docNo,
    })
  }
}
