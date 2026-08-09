import {
  AUTH_ERRORS,
  PERMISSION_CODES,
  type PasswordResetRequestContract,
  type PasswordResetRequestResultContract,
} from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'


import { BizError } from '../../../common/errors/biz-error'
import { DOMAIN_EVENTS, DomainEventPublisher  } from '../../../platform/events'
import { NotificationService } from '../../../platform/notification'
import { DOC_TYPES, DocNumberService  } from '../../../platform/numbering'
import { normalizeAccount } from '../constants/account-rules'
import {
  PASSWORD_RESET_REPOSITORY,
  type PasswordResetRepositoryPort,
} from '../repositories/password-reset.repository.port'
import { USER_REPOSITORY, type UserRepositoryPort } from '../repositories/user.repository.port'


import type { LoginAudience } from '@prisma/client'

const HANDLER_HINT =
  '已派单至信息部 IT 系统管理员：核实身份后由管理员重置密码并线下通知本人，' +
  '系统不发送邮件或短信重置链接。如需加急请直接联系信息部。'

/** 忘记密码 = 提交重置申请给 IT 管理员（产品决策：不做邮箱/短信自助找回）。 */
@Injectable()
export class PasswordResetRequestService {
  constructor(
    private readonly docNumber: DocNumberService,
    private readonly notifications: NotificationService,
    private readonly events: DomainEventPublisher,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_RESET_REPOSITORY) private readonly repository: PasswordResetRepositoryPort,
  ) {}

  async submit(
    input: PasswordResetRequestContract,
    traceId?: string | null,
  ): Promise<PasswordResetRequestResultContract> {
    const account = normalizeAccount(input.account)
    this.validate(input, account)

    const audience: LoginAudience = input.audience === 'portal' ? 'PORTAL' : 'INTERNAL'
    if (await this.repository.hasPending(audience, account)) {
      throw new BizError(AUTH_ERRORS.RESET_DUPLICATED)
    }

    const requestNo = await this.docNumber.next(DOC_TYPES.PASSWORD_RESET)
    const record = await this.repository.create({
      requestNo,
      audience,
      account,
      applicantName: input.applicantName.trim(),
      department: input.department.trim(),
      contact: input.contact.trim(),
      reason: input.reason?.trim() ?? null,
    })

    await this.announce(record.requestNo, account, input.applicantName.trim(), traceId)

    return {
      requestNo: record.requestNo,
      submittedAt: record.submittedAt.toISOString(),
      handlerHint: HANDLER_HINT,
    }
  }

  private validate(input: PasswordResetRequestContract, account: string): void {
    if (
      !account ||
      !input.applicantName?.trim() ||
      !input.department?.trim() ||
      !input.contact?.trim()
    ) {
      throw new BizError(AUTH_ERRORS.RESET_FIELDS_REQUIRED)
    }
  }

  private async announce(
    requestNo: string,
    account: string,
    applicantName: string,
    traceId?: string | null,
  ): Promise<void> {
    const admins = await this.users.listUserCodesByPermission(PERMISSION_CODES.IT_ACCOUNT_ADMIN)

    await this.notifications.notifyMany(admins, {
      category: 'PASSWORD_RESET',
      title: `密码重置申请：${applicantName}（${account}）`,
      body: `申请单号 ${requestNo}。核实身份后重置密码并线下通知本人。`,
      link: `/system/password-resets/${requestNo}`,
      docType: DOC_TYPES.PASSWORD_RESET,
      docId: requestNo,
    })

    await this.events.publish({
      name: DOMAIN_EVENTS.PASSWORD_RESET_REQUESTED,
      payload: { requestNo, account, applicantName },
      traceId,
    })
  }
}
