import { ORDER_ERRORS, PERMISSION_CODES } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import {
  CHANGE_TYPE_LABEL,
  REDIRECTED_INTENTS,
  isAllowedChangeType,
} from '../constants/order-change-rules'
import {
  ORDER_CHANGE_REQUEST_REPOSITORY,
  type OrderChangeRequestRecord,
  type OrderChangeRequestRepositoryPort,
} from '../repositories/order-change-request.repository.port'

import { SalesOrderService, type OrderActor } from './sales-order.service'

import type { OrderChangeType } from '@prisma/client'

export interface SubmitOrderChangeInput {
  orderId: string
  /** 针对某一行；为空表示整单 */
  orderLineId: string | null
  changeType: string
  origin: 'customer' | 'internal'
  urgent: boolean
  beforeValue: string
  afterValue: string
  reason: string
  costOwner: string | null
}

/**
 * 订单修改申请（业务规格 4.6）。
 *
 * 这个模块存在的意义有一半是**挡住不该走这条路的诉求**：
 * 改价与换产品要回报价单修改申请，改图/改材料/改表处要走 ECN。
 * 挡的方式是白名单——只认 `ALLOWED_CHANGE_TYPES` 里那五种，
 * 其余一律拒绝并告诉调用方正确去处，而不是默默放行成一条 `changeType: 'price'` 的记录。
 */
@Injectable()
export class OrderChangeRequestService {
  constructor(
    private readonly docNumber: DocNumberService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly orders: SalesOrderService,
    @Inject(ORDER_CHANGE_REQUEST_REPOSITORY)
    private readonly repository: OrderChangeRequestRepositoryPort,
  ) {}

  async submit(
    input: SubmitOrderChangeInput,
    actor: OrderActor,
  ): Promise<OrderChangeRequestRecord> {
    SalesOrderService.assertSales(actor)
    const changeType = OrderChangeRequestService.assertChangeType(input.changeType)

    const reason = input.reason.trim()
    if (!reason) {
      throw new BizError(ORDER_ERRORS.PREREQUISITES_MISSING, {
        message: '订单修改申请必须说明原因',
      })
    }

    const order = await this.orders.load(input.orderId)
    const requestNo = await this.docNumber.next(DOC_TYPES.ORDER_CHANGE_REQUEST)

    const record = await this.repository.create({
      requestNo,
      orderId: order.id,
      orderLineId: input.orderLineId,
      changeType,
      origin: input.origin,
      urgent: input.urgent,
      beforeValue: input.beforeValue,
      afterValue: input.afterValue,
      reason,
      costOwner: input.costOwner,
      submittedBy: actor.userCode,
    })

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'order-change.submit',
      entityType: 'OrderChangeRequest',
      entityId: record.requestNo,
      after: {
        orderNo: order.docNo,
        changeType: CHANGE_TYPE_LABEL[changeType],
        before: input.beforeValue,
        after: input.afterValue,
      },
    })

    return record
  }

  /**
   * 只认白名单里的五种。改价、换产品、改图纸这类诉求在这里被挡下，
   * 并把正确的去处写进错误信息——让人知道该走哪条路，比单纯说「不允许」有用。
   */
  static assertChangeType(value: string): OrderChangeType {
    if (isAllowedChangeType(value)) return value

    const redirect = REDIRECTED_INTENTS[value.toLowerCase()]
    throw new BizError(ORDER_ERRORS.CHANGE_FIELD_LOCKED, {
      message: redirect ?? `订单修改申请不支持「${value}」，只能改数量、交期、收货信息、包装或取消订单`,
      details: { changeType: value, redirect: redirect ?? null },
    })
  }

  async approve(
    id: string,
    versionLock: number,
    actor: OrderActor,
  ): Promise<OrderChangeRequestRecord> {
    OrderChangeRequestService.assertApprover(actor)
    const current = await this.load(id)

    const handled = await this.persist(id, versionLock, {
      status: 'APPROVED',
      handledBy: actor.userCode,
      handledAt: new Date(),
    })

    await this.notify(current, '订单修改申请已批准', `${current.requestNo} 已批准，变更将同步给 PMC 重排计划。`)
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'order-change.approve',
      entityType: 'OrderChangeRequest',
      entityId: current.requestNo,
    })

    return handled
  }

  /** 驳回：理由必填，原样回到提交人的工作台。 */
  async reject(
    id: string,
    versionLock: number,
    reason: string,
    actor: OrderActor,
  ): Promise<OrderChangeRequestRecord> {
    OrderChangeRequestService.assertApprover(actor)
    const trimmed = reason.trim()
    if (!trimmed) throw new BizError(ORDER_ERRORS.CHANGE_REJECT_REASON_REQUIRED)

    const current = await this.load(id)
    const handled = await this.persist(id, versionLock, {
      status: 'REJECTED',
      handledBy: actor.userCode,
      handledAt: new Date(),
      rejectReason: trimmed,
    })

    await this.notify(current, '订单修改申请被驳回', `驳回理由：${trimmed}`)
    return handled
  }

  async load(id: string): Promise<OrderChangeRequestRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new BizError(ORDER_ERRORS.CHANGE_REQUEST_NOT_FOUND)
    return record
  }

  listByOrder(orderId: string): Promise<OrderChangeRequestRecord[]> {
    return this.repository.listByOrder(orderId)
  }

  private static assertApprover(actor: OrderActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.ORDER_APPROVE)) {
      throw new BizError(ORDER_ERRORS.APPROVE_ROLE_REQUIRED, {
        message: '订单修改申请需要业务经理权限处理',
      })
    }
  }

  private async persist(
    id: string,
    versionLock: number,
    data: Parameters<OrderChangeRequestRepositoryPort['handle']>[2],
  ): Promise<OrderChangeRequestRecord> {
    const handled = await this.repository.handle(id, versionLock, data)
    if (!handled) throw new BizError(ORDER_ERRORS.CHANGE_REQUEST_ALREADY_HANDLED)
    return handled
  }

  private notify(
    record: OrderChangeRequestRecord,
    title: string,
    body: string,
  ): Promise<unknown> {
    return this.notifications.notify({
      recipientUserCode: record.submittedBy,
      category: 'ORDER_CHANGE_RESULT',
      title,
      body,
      docType: DOC_TYPES.ORDER_CHANGE_REQUEST,
      docId: record.requestNo,
    })
  }
}
