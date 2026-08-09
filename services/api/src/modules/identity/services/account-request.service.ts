import {
  AUTH_ERRORS,
  PERMISSION_CODES,
  type AccountRequestContract,
  type AccountRequestResultContract,
} from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { DOMAIN_EVENTS, DomainEventPublisher  } from '../../../platform/events'
import { NotificationService } from '../../../platform/notification'
import { DOC_TYPES, DocNumberService  } from '../../../platform/numbering'
import { isValidAccount, normalizeAccount } from '../constants/account-rules'
import {
  ACCOUNT_REQUEST_REPOSITORY,
  type AccountRequestRepositoryPort,
} from '../repositories/account-request.repository.port'
import { USER_REPOSITORY, type UserRepositoryPort } from '../repositories/user.repository.port'

import { AccountAvailabilityService } from './account-availability.service'
import { buildHandlerHint, buildReusedFrom } from './account-request-hint'
import { PasswordService } from './password.service'
import { UserCodeService } from './user-code.service'

/**
 * 登录页「申请账户」（业务规格「平台联动需求」）：
 * 填写姓名、部门、用户名、密码 → 提交时立刻发放唯一编码 → 派单给 IT 系统管理员审批开通。
 */
@Injectable()
export class AccountRequestService {
  constructor(
    private readonly availability: AccountAvailabilityService,
    private readonly passwords: PasswordService,
    private readonly userCodes: UserCodeService,
    private readonly docNumber: DocNumberService,
    private readonly notifications: NotificationService,
    private readonly events: DomainEventPublisher,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(ACCOUNT_REQUEST_REPOSITORY) private readonly requests: AccountRequestRepositoryPort,
  ) {}

  async submit(
    input: AccountRequestContract,
    traceId?: string | null,
  ): Promise<AccountRequestResultContract> {
    const account = this.validate(input)
    this.passwords.assertStrength(input.password, input.confirmPassword)

    const conflict = await this.availability.findConflict(account)
    if (conflict) {
      throw new BizError(AUTH_ERRORS.ACCOUNT_TAKEN, {
        message: `用户名「${account}」已被占用，请更换后重新提交`,
      })
    }

    const released = await this.users.findReleasedAccount(account)
    const [requestNo, userCode, passwordHash] = await Promise.all([
      this.docNumber.next(DOC_TYPES.ACCOUNT_REQUEST),
      this.userCodes.issue('ACCOUNT_REQUEST', `账户申请：${input.employeeName.trim()}`),
      this.passwords.hash(input.password),
    ])

    const record = await this.requests.create({
      requestNo,
      employeeName: input.employeeName.trim(),
      department: input.department.trim(),
      departmentId: null,
      account,
      passwordHash,
      contact: input.contact?.trim() ?? null,
      reason: input.reason?.trim() ?? null,
      userCode,
      reusedFrom: buildReusedFrom(released),
    })

    await this.announce(record.requestNo, input.employeeName.trim(), account, userCode, traceId)

    return {
      requestNo: record.requestNo,
      account,
      userCode,
      submittedAt: record.submittedAt.toISOString(),
      ...(record.reusedFrom ? { reusedFrom: record.reusedFrom } : {}),
      handlerHint: buildHandlerHint(userCode, released),
    }
  }

  private validate(input: AccountRequestContract): string {
    const account = normalizeAccount(input.account)

    if (!input.employeeName?.trim() || !input.department?.trim() || !account) {
      throw new BizError(AUTH_ERRORS.REQUEST_FIELDS_REQUIRED)
    }
    if (!isValidAccount(account)) {
      throw new BizError(AUTH_ERRORS.ACCOUNT_PATTERN_INVALID)
    }

    return account
  }

  private async announce(
    requestNo: string,
    employeeName: string,
    account: string,
    userCode: string,
    traceId?: string | null,
  ): Promise<void> {
    const admins = await this.users.listUserCodesByPermission(PERMISSION_CODES.IT_ACCOUNT_ADMIN)

    await this.notifications.notifyMany(admins, {
      category: 'ACCOUNT_REQUEST',
      title: `账户申请待审批：${employeeName}（${account}）`,
      body: `申请单号 ${requestNo}，唯一编码 ${userCode}。请核实在职状态与所属部门后开通并分配角色。`,
      link: `/system/account-requests/${requestNo}`,
      docType: DOC_TYPES.ACCOUNT_REQUEST,
      docId: requestNo,
    })

    await this.events.publish({
      name: DOMAIN_EVENTS.ACCOUNT_REQUEST_SUBMITTED,
      payload: { requestNo, account, userCode, employeeName },
      traceId,
    })
  }
}
