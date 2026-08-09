import { Inject, Injectable } from '@nestjs/common'


import {
  buildAccountSuggestions,
  isValidAccount,
  normalizeAccount,
} from '../constants/account-rules'
import {
  ACCOUNT_REQUEST_REPOSITORY,
  type AccountRequestRepositoryPort,
} from '../repositories/account-request.repository.port'
import { USER_REPOSITORY, type UserRepositoryPort } from '../repositories/user.repository.port'

import type { AccountAvailabilityContract } from '@machining-erp/shared'

function formatDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : '（离职日期缺失）'
}

/**
 * 用户名可用性判定（业务规格「用户名释放规则」）。
 *
 * 三种结果：
 *  - 在职账号占用 / 待审批申请占用 → 不可用，并给出候选建议；
 *  - 离职释放出来的用户名 → **可用**，但提示原使用人与离职日期，
 *    并说明本次注册会另行生成新的唯一编码，与原使用人无关；
 *  - 其余 → 可用。
 */
@Injectable()
export class AccountAvailabilityService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(ACCOUNT_REQUEST_REPOSITORY) private readonly requests: AccountRequestRepositoryPort,
  ) {}

  async check(rawAccount: string, now: Date = new Date()): Promise<AccountAvailabilityContract> {
    const account = normalizeAccount(rawAccount)

    if (!isValidAccount(account)) {
      return {
        account,
        available: false,
        reason: '用户名需 4–20 位，以字母开头，只能包含小写字母、数字、点或下划线',
        suggestions: [],
      }
    }

    const conflict = await this.findConflict(account)
    if (conflict) {
      return {
        account,
        available: false,
        reason: conflict,
        suggestions: await this.suggest(account, now),
      }
    }

    const released = await this.users.findReleasedAccount(account)
    if (released) {
      return {
        account,
        available: true,
        released: true,
        reason:
          `该用户名原由 ${released.formerHolder} 使用，其已于 ${formatDate(released.leftAt)} 离职，` +
          '用户名已释放、可重新登记；本次注册会另行生成新的唯一编码，与原使用人的编码无关',
        suggestions: [],
      }
    }

    return { account, available: true, suggestions: [] }
  }

  /** 供 account-request.service 复用的硬校验：占用即返回原因，未占用返回 null。 */
  async findConflict(account: string): Promise<string | null> {
    if (await this.users.isAccountInUse('INTERNAL', account)) {
      return '该用户名已被现有账号占用，请更换'
    }
    if (await this.requests.hasPending(account)) {
      return '该用户名已有待审批的申请占用，请更换'
    }
    return null
  }

  private async suggest(account: string, now: Date): Promise<string[]> {
    const candidates = buildAccountSuggestions(account, now.getFullYear())
    const checked = await Promise.all(
      candidates.map(async (candidate) => ((await this.findConflict(candidate)) ? null : candidate)),
    )
    return checked.filter((value): value is string => value !== null)
  }
}
