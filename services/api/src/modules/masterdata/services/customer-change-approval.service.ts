import { CUSTOMER_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DOC_TYPES } from '../../../platform/numbering'
import {
  CUSTOMER_CHANGE_REQUEST_REPOSITORY,
  type CustomerChangeRequestRecord,
  type CustomerChangeRequestRepositoryPort,
} from '../repositories/customer-change-request.repository.port'
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepositoryPort,
} from '../repositories/customer.repository.port'

import { changesToPatch, describeChanges } from './customer-change-diff'
import { CustomerUpdateService } from './customer-update.service'
import { CustomerService } from './customer.service'

import type { Viewer } from './customer-visibility'
import type { CustomerChangeRequestView } from '../dto/customer-change-request-view.dto'

function toView(record: CustomerChangeRequestRecord): CustomerChangeRequestView {
  return {
    id: record.id,
    requestNo: record.requestNo,
    customerId: record.customerId,
    changes: record.changes,
    reason: record.reason,
    status: record.status,
    submittedBy: record.submittedBy,
    submittedAt: record.submittedAt.toISOString(),
    decidedBy: record.decidedBy,
    decidedAt: record.decidedAt?.toISOString() ?? null,
    rejectReason: record.rejectReason,
  }
}

/** 敏感字段变更的审批闭环：通过才落库，驳回必须填理由。 */
@Injectable()
export class CustomerChangeApprovalService {
  constructor(
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepositoryPort,
    @Inject(CUSTOMER_CHANGE_REQUEST_REPOSITORY)
    private readonly changeRequests: CustomerChangeRequestRepositoryPort,
  ) {}

  async listPending(customerId: string): Promise<CustomerChangeRequestView[]> {
    const rows = await this.changeRequests.listByCustomer(customerId, 'SUBMITTED')
    return rows.map(toView)
  }

  async approve(id: string, viewer: Viewer): Promise<CustomerChangeRequestView> {
    const request = await this.load(id)
    CustomerUpdateService.assertCanDecide(viewer, request.submittedBy)

    const customer = await this.customers.findById(request.customerId)
    if (!customer) throw new BizError(CUSTOMER_ERRORS.NOT_FOUND)

    const decided = await this.changeRequests.decide({
      id: request.id,
      version: request.version,
      status: 'APPROVED',
      decidedBy: viewer.userCode,
      decidedAt: new Date(),
      rejectReason: null,
    })
    if (!decided) throw new BizError(CUSTOMER_ERRORS.CHANGE_REQUEST_ALREADY_DECIDED)

    const applied = await this.customers.update({
      id: customer.id,
      version: customer.version,
      updatedBy: viewer.userCode,
      patch: changesToPatch(request.changes),
    })
    if (!applied) throw CustomerService.versionConflict()

    await this.announce(request, customer.code, viewer, 'APPROVED')
    return toView({ ...request, status: 'APPROVED', decidedBy: viewer.userCode, decidedAt: new Date() })
  }

  async reject(id: string, reason: string, viewer: Viewer): Promise<CustomerChangeRequestView> {
    if (!reason?.trim()) throw new BizError(CUSTOMER_ERRORS.REJECT_REASON_REQUIRED)

    const request = await this.load(id)
    CustomerUpdateService.assertCanDecide(viewer, request.submittedBy)

    const decided = await this.changeRequests.decide({
      id: request.id,
      version: request.version,
      status: 'REJECTED',
      decidedBy: viewer.userCode,
      decidedAt: new Date(),
      rejectReason: reason.trim(),
    })
    if (!decided) throw new BizError(CUSTOMER_ERRORS.CHANGE_REQUEST_ALREADY_DECIDED)

    const customer = await this.customers.findById(request.customerId)
    await this.announce(request, customer?.code ?? request.customerId, viewer, 'REJECTED', reason.trim())

    return toView({
      ...request,
      status: 'REJECTED',
      decidedBy: viewer.userCode,
      decidedAt: new Date(),
      rejectReason: reason.trim(),
    })
  }

  private async load(id: string): Promise<CustomerChangeRequestRecord> {
    const request = await this.changeRequests.findById(id)
    if (!request) throw new BizError(CUSTOMER_ERRORS.CHANGE_REQUEST_NOT_FOUND)
    if (request.status !== 'SUBMITTED') {
      throw new BizError(CUSTOMER_ERRORS.CHANGE_REQUEST_ALREADY_DECIDED)
    }
    return request
  }

  private async announce(
    request: CustomerChangeRequestRecord,
    customerCode: string,
    viewer: Viewer,
    outcome: 'APPROVED' | 'REJECTED',
    rejectReason?: string,
  ): Promise<void> {
    const verdict = outcome === 'APPROVED' ? '已通过' : '被驳回'

    await this.audit.record({
      actorUserCode: viewer.userCode,
      action: `customer.sensitive-change.${outcome.toLowerCase()}`,
      entityType: 'Customer',
      entityId: customerCode,
      before: { requestNo: request.requestNo, changes: describeChanges(request.changes) },
      after: { outcome, rejectReason: rejectReason ?? null },
    })

    // 驳回理由必须回到提交人手上，否则业务只知道被拒不知道为什么
    await this.notifications.notify({
      recipientUserCode: request.submittedBy,
      category: 'CUSTOMER_CHANGE',
      title: `客户敏感字段变更${verdict}：${request.requestNo}`,
      body: rejectReason ? `驳回理由：${rejectReason}` : describeChanges(request.changes),
      docType: DOC_TYPES.CUSTOMER_CHANGE,
      docId: request.requestNo,
    })
  }
}
