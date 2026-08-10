import { CUSTOMER_ERRORS, PERMISSION_CODES, SYSTEM_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import {
  CUSTOMER_REPOSITORY,
  type CustomerListFilter,
  type CustomerRecord,
  type CustomerRepositoryPort,
} from '../repositories/customer.repository.port'

import { checkCustomerCompleteness, type CompletenessResult } from './customer-completeness.rules'
import { toCreateCustomerData } from './customer-create.mapper'
import { validateCustomerProfile, type CustomerProfileInput } from './customer-validation.rules'
import { toCustomerView, toCustomerViews, type Viewer } from './customer-visibility'

import type { CreateCustomerInput } from './customer-create-input'
import type { CustomerView } from '../dto/customer-view.dto'

export interface ListCustomersInput {
  q?: string
  page: number
  pageSize: number
}

/**
 * 给别的模块用的最小客户画像。刻意只含不敏感字段：
 * 谁需要银行账号或授信额度，就该走 CustomerView 的权限判定，而不是从这里绕过去。
 */
export interface CustomerProfile {
  id: string
  code: string
  name: string
  shortName: string
  paymentTerm: CustomerRecord['paymentTerm']
  currency: string
  salesUserCode: string | null
}

/**
 * 开票要用到的客户档案字段。含税号与银行账号，因此只给发票模块，
 * 不并进给所有模块用的 `CustomerProfile`。
 */
export interface CustomerInvoiceProfile {
  id: string
  code: string
  name: string
  region: CustomerRecord['region']
  invoiceType: CustomerRecord['invoiceType']
  taxNo: string | null
  bankAccount: string | null
  invoiceAddress: string
  ownerEmail: string | null
  paymentTerm: CustomerRecord['paymentTerm']
  currency: string
}

/**
 * 客户档案主用例。
 *
 * 三条硬规则在这里落地：
 * 1. 客户编号由平台统一编号规则生成，任何入参里的 code 一律忽略并报错；
 * 2. 数据权限在查询层强制注入——没有 `customer.view-all` 的业务员只看得到自己负责的客户；
 * 3. 返回体一律经 `toCustomerView` 裁剪，财务字段对未授权者打码。
 */
@Injectable()
export class CustomerService {
  constructor(
    private readonly docNumber: DocNumberService,
    private readonly audit: AuditService,
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepositoryPort,
  ) {}

  async list(input: ListCustomersInput, viewer: Viewer): Promise<{ items: CustomerView[]; total: number }> {
    const filter: CustomerListFilter = {
      q: input.q,
      page: input.page,
      pageSize: input.pageSize,
      ...this.scopeOf(viewer),
    }

    const result = await this.customers.list(filter)
    return { items: toCustomerViews(result.items, viewer), total: result.total }
  }

  async detail(id: string, viewer: Viewer): Promise<CustomerView> {
    return toCustomerView(await this.loadVisible(id, viewer), viewer)
  }

  async create(input: CreateCustomerInput, viewer: Viewer): Promise<CustomerView> {
    this.assertValid(input)

    if (await this.customers.existsByName(input.name.trim())) {
      throw new BizError(CUSTOMER_ERRORS.DUPLICATE_NAME, {
        message: `客户「${input.name.trim()}」已存在，请勿重复建档`,
      })
    }

    const code = await this.docNumber.next(DOC_TYPES.CUSTOMER)
    const record = await this.customers.create(toCreateCustomerData(input, code, viewer.userCode))

    await this.audit.record({
      actorUserCode: viewer.userCode,
      action: 'customer.create',
      entityType: 'Customer',
      entityId: record.code,
      after: { code: record.code, name: record.name, status: record.status },
    })

    return toCustomerView(record, viewer)
  }

  /**
   * 下单前的档案完整性闸门，供 contract-order 模块调用。
   * 不满足时抛 ORD_2104，`details.missing` 里是可直接展示的缺失项清单。
   */
  async assertReadyForOrder(customerCode: string): Promise<CustomerRecord> {
    const record = await this.customers.findByCode(customerCode)
    if (!record) {
      throw new BizError(CUSTOMER_ERRORS.NOT_FOUND, { message: `客户 ${customerCode} 不存在` })
    }

    const result = this.completenessOf(record)
    if (!result.ready) {
      throw new BizError(CUSTOMER_ERRORS.PROFILE_INCOMPLETE, {
        message: `客户「${record.shortName}」档案未补全，不能下单：${result.missing.join('、')}`,
        details: { customerCode, missing: result.missing },
      })
    }

    return record
  }

  /**
   * 跨模块只读档案：编号、名称、付款条件、币种。
   *
   * 与 `loadVisible` 的区别是**不做业务员可见范围过滤**——调用方是别的模块
   * （出货信用闸门、对账单抬头），它们要的是客观事实而不是某个人看得到的视图。
   * 也因此这里只回不敏感的几个字段，银行账号、授信一律不出这个门。
   */
  async profileFor(customerId: string): Promise<CustomerProfile> {
    const record = await this.customers.findById(customerId)
    if (!record) throw new BizError(CUSTOMER_ERRORS.NOT_FOUND)

    return {
      id: record.id,
      code: record.code,
      name: record.name,
      shortName: record.shortName,
      paymentTerm: record.paymentTerm,
      currency: record.currency,
      salesUserCode: record.salesUserCode,
    }
  }

  /**
   * 开票专用档案读取。
   *
   * 比 `profileFor` 多出税号、银行账号、开票地址与发票种类——开票绕不开这几项。
   * 刻意与 `profileFor` 分开而不是把字段堆进去：那个方法给出货信用闸门等场景用，
   * 不该顺手把税务字段递出去。这里同样**不做业务员可见范围过滤**，
   * 调用方是发票模块，要的是客观事实。
   */
  async invoiceProfileFor(customerId: string): Promise<CustomerInvoiceProfile> {
    const record = await this.customers.findById(customerId)
    if (!record) throw new BizError(CUSTOMER_ERRORS.NOT_FOUND)

    return {
      id: record.id,
      code: record.code,
      name: record.name,
      region: record.region,
      invoiceType: record.invoiceType,
      taxNo: record.taxNo,
      bankAccount: record.bankAccount,
      invoiceAddress: record.invoiceAddress,
      ownerEmail: record.ownerEmail,
      paymentTerm: record.paymentTerm,
      currency: record.currency,
    }
  }

  async completeness(id: string, viewer: Viewer): Promise<CompletenessResult> {
    return this.completenessOf(await this.loadVisible(id, viewer))
  }

  private completenessOf(record: CustomerRecord): CompletenessResult {
    return checkCustomerCompleteness({
      status: record.status,
      region: record.region,
      taxNo: record.taxNo,
      invoiceAddress: record.invoiceAddress,
      bankAccount: record.bankAccount,
      paymentTerm: record.paymentTerm,
      invoiceType: record.invoiceType,
      salesUserCode: record.salesUserCode,
      deliveryAddressCount: record.addresses.length,
      hasDefaultDeliveryAddress: record.addresses.some((address) => address.isDefault),
    })
  }

  /** 越权一律返回 404 而不是 403（api-conventions.md「认证与权限」）。 */
  async loadVisible(id: string, viewer: Viewer): Promise<CustomerRecord> {
    const record = await this.customers.findById(id)
    const scope = this.scopeOf(viewer)

    if (!record || (scope.salesUserCode && record.salesUserCode !== scope.salesUserCode)) {
      throw new BizError(CUSTOMER_ERRORS.NOT_FOUND)
    }
    return record
  }

  private scopeOf(viewer: Viewer): { salesUserCode?: string } {
    return viewer.permissions.includes(PERMISSION_CODES.CUSTOMER_VIEW_ALL)
      ? {}
      : { salesUserCode: viewer.userCode }
  }

  private assertValid(input: CustomerProfileInput): void {
    const issues = validateCustomerProfile(input)
    if (issues.length === 0) return

    throw new BizError(CUSTOMER_ERRORS.VALIDATION_FAILED, {
      message: issues.map((issue) => issue.message).join('；'),
      details: { issues },
    })
  }

  /** 乐观锁冲突的统一出口，供改档路径复用。 */
  static versionConflict(): BizError {
    return new BizError(SYSTEM_ERRORS.VERSION_CONFLICT)
  }
}
