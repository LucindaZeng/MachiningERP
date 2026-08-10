import { CUSTOMER_ERRORS, PERMISSION_CODES } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import { UserDirectoryService } from '../../identity'
import {
  CUSTOMER_CHANGE_REQUEST_REPOSITORY,
  type CustomerChangeRequestRepositoryPort,
} from '../repositories/customer-change-request.repository.port'
import {
  CUSTOMER_REPOSITORY,
  type CustomerRecord,
  type CustomerRepositoryPort,
  type DeliveryAddressDraft,
  type DeliveryAddressRecord,
} from '../repositories/customer.repository.port'

import { describeChanges, splitCustomerChanges, type FieldChange } from './customer-change-diff'
import { validateCustomerProfile } from './customer-validation.rules'
import { toCustomerView, type Viewer } from './customer-visibility'
import { CustomerService } from './customer.service'

import type { CustomerView } from '../dto/customer-view.dto'

export interface UpdateCustomerInput {
  version: number
  patch: Record<string, string | number | boolean | null>
  addresses?: Array<Omit<DeliveryAddressRecord, 'id' | 'sortOrder'>>
  /** 敏感字段变更必须给理由，作为审批依据 */
  reason?: string
}

export interface UpdateCustomerResult {
  customer: CustomerView
  /** 命中敏感字段时返回待审批的申请单号；常规变更为 null */
  pendingChangeRequestNo: string | null
  pendingChanges: FieldChange[]
}

/**
 * 改档。常规字段直接生效，敏感字段（银行账号、付款条件等）
 * 一律转成变更申请，审批通过后才落库（业务规格 3.2）。
 */
@Injectable()
export class CustomerUpdateService {
  constructor(
    private readonly customerService: CustomerService,
    private readonly docNumber: DocNumberService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly directory: UserDirectoryService,
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepositoryPort,
    @Inject(CUSTOMER_CHANGE_REQUEST_REPOSITORY)
    private readonly changeRequests: CustomerChangeRequestRepositoryPort,
  ) {}

  async update(id: string, input: UpdateCustomerInput, viewer: Viewer): Promise<UpdateCustomerResult> {
    const before = await this.customerService.loadVisible(id, viewer)
    if ('code' in input.patch) {
      throw new BizError(CUSTOMER_ERRORS.CODE_NOT_EDITABLE)
    }

    const addresses = input.addresses?.map((address, index) => ({ ...address, sortOrder: index }))
    this.assertMergedProfileValid(before, input.patch, addresses)

    const { direct, sensitive } = splitCustomerChanges(
      before as unknown as Record<string, unknown>,
      input.patch,
    )
    if (sensitive.length > 0 && !input.reason?.trim()) {
      throw new BizError(CUSTOMER_ERRORS.VALIDATION_FAILED, {
        message: `变更「${sensitive.map((change) => change.label).join('、')}」属于敏感字段，必须填写变更理由`,
      })
    }

    const updated = await this.applyDirect(before, input.version, direct, addresses, viewer)
    const pending = sensitive.length > 0 ? await this.raiseChangeRequest(before, sensitive, input.reason ?? '', viewer) : null

    return {
      customer: toCustomerView(updated, viewer),
      pendingChangeRequestNo: pending,
      pendingChanges: sensitive,
    }
  }

  private async applyDirect(
    before: CustomerRecord,
    version: number,
    direct: Record<string, string | number | boolean | null>,
    addresses: DeliveryAddressDraft[] | undefined,
    viewer: Viewer,
  ): Promise<CustomerRecord> {
    if (Object.keys(direct).length === 0 && !addresses) {
      // 没有实际改动也要校验版本，避免「基于旧版本提交」被静默放过
      if (version !== before.version) throw CustomerService.versionConflict()
      return before
    }

    const updated = await this.customers.update({
      id: before.id,
      version,
      updatedBy: viewer.userCode,
      patch: direct,
      ...(addresses ? { addresses } : {}),
    })
    if (!updated) throw CustomerService.versionConflict()

    await this.audit.record({
      actorUserCode: viewer.userCode,
      action: 'customer.update',
      entityType: 'Customer',
      entityId: before.code,
      before: this.pick(before, Object.keys(direct)),
      after: direct,
    })

    return updated
  }

  private async raiseChangeRequest(
    customer: CustomerRecord,
    changes: FieldChange[],
    reason: string,
    viewer: Viewer,
  ): Promise<string> {
    const requestNo = await this.docNumber.next(DOC_TYPES.CUSTOMER_CHANGE)
    await this.changeRequests.create({
      requestNo,
      customerId: customer.id,
      changes,
      reason: reason.trim(),
      submittedBy: viewer.userCode,
    })

    await this.audit.record({
      actorUserCode: viewer.userCode,
      action: 'customer.sensitive-change.submit',
      entityType: 'Customer',
      entityId: customer.code,
      after: { requestNo, changes: describeChanges(changes) },
    })

    const approvers = await this.directory.listUserCodesByPermission(
      PERMISSION_CODES.CUSTOMER_SENSITIVE_EDIT,
    )
    await this.notifications.notifyMany(approvers, {
      category: 'CUSTOMER_CHANGE',
      title: `客户敏感字段变更待审批：${customer.shortName}`,
      body: `${describeChanges(changes)}。理由：${reason.trim()}`,
      link: `/sales/customers/${customer.id}`,
      docType: DOC_TYPES.CUSTOMER_CHANGE,
      docId: requestNo,
    })

    return requestNo
  }

  /** 把 patch 合并到现状后重跑完整校验，避免改出「国内客户没有税号」这种半成品。 */
  private assertMergedProfileValid(
    before: CustomerRecord,
    patch: Record<string, unknown>,
    addresses: DeliveryAddressDraft[] | undefined,
  ): void {
    const merged = { ...before, ...patch } as unknown as CustomerRecord
    const issues = validateCustomerProfile({
      name: merged.name,
      shortName: merged.shortName,
      region: merged.region,
      country: merged.country,
      ownerName: merged.ownerName,
      ownerPhone: merged.ownerPhone,
      taxNo: merged.taxNo,
      invoiceAddress: merged.invoiceAddress,
      bankAccount: merged.bankAccount,
      paymentTerm: merged.paymentTerm,
      depositBps: merged.depositBps,
      invoiceType: merged.invoiceType,
      settlement: merged.settlement,
      addresses: (addresses ?? before.addresses).map((address) => ({
        label: address.label,
        receiver: address.receiver,
        phone: address.phone,
        address: address.address,
        isDefault: address.isDefault,
      })),
    })

    if (issues.length > 0) {
      throw new BizError(CUSTOMER_ERRORS.VALIDATION_FAILED, {
        message: issues.map((issue) => issue.message).join('；'),
        details: { issues },
      })
    }
  }

  private pick(record: CustomerRecord, keys: string[]): Record<string, unknown> {
    const source = record as unknown as Record<string, unknown>
    return Object.fromEntries(keys.map((key) => [key, source[key]]))
  }

  /** 审批人必须持有敏感字段权限，且不能是提交人本人（职责分离）。 */
  static assertCanDecide(viewer: Viewer, submittedBy: string): void {
    if (!viewer.permissions.includes(PERMISSION_CODES.CUSTOMER_SENSITIVE_EDIT)) {
      throw new BizError(CUSTOMER_ERRORS.VALIDATION_FAILED, {
        message: '没有客户敏感字段审批权限',
      })
    }
    if (viewer.userCode === submittedBy) {
      throw new BizError(CUSTOMER_ERRORS.VALIDATION_FAILED, {
        message: '不能审批自己提交的敏感字段变更（职责分离）',
      })
    }
  }
}
