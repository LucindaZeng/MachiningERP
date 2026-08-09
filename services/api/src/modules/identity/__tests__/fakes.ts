
import type {
  AccountRequestRecord,
  AccountRequestRepositoryPort,
  CreateAccountRequestInput,
  DecideAccountRequestInput,
} from '../repositories/account-request.repository.port'
import type { UserCodeRepositoryPort } from '../repositories/user-code.repository.port'
import type {
  CreateUserInput,
  ReleasedAccountRecord,
  UserRecord,
  UserRepositoryPort,
} from '../repositories/user.repository.port'
import type { LoginAudience } from '@prisma/client'

/** 内存假仓储：service 层单测不需要数据库（Prisma 只住在 repositories/ 里）。 */
export class FakeUserRepository implements UserRepositoryPort {
  readonly users: UserRecord[] = []
  readonly released: ReleasedAccountRecord[] = []
  adminUserCodes: string[] = ['WFX-2019-0001']

  async findForLogin(audience: LoginAudience, account: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.audience === audience && user.account === account) ?? null
  }

  async findByUserCode(userCode: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.userCode === userCode) ?? null
  }

  async isAccountInUse(audience: LoginAudience, account: string): Promise<boolean> {
    return this.users.some(
      (user) =>
        user.audience === audience && user.account === account && user.employmentStatus === 'ACTIVE',
    )
  }

  async findReleasedAccount(account: string): Promise<ReleasedAccountRecord | null> {
    return this.released.find((item) => item.formerAccount === account) ?? null
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const record: UserRecord = {
      id: `user-${this.users.length + 1}`,
      userCode: input.userCode,
      account: input.account,
      audience: input.audience,
      formerAccount: null,
      displayName: input.displayName,
      departmentName: null,
      passwordHash: input.passwordHash,
      status: 'ACTIVE',
      employmentStatus: 'ACTIVE',
      leftAt: null,
      roleCodes: [],
      permissionCodes: [],
    }
    this.users.push(record)
    return record
  }

  async assignRoles(): Promise<void> {
    // 单测不关心角色落库
  }

  async touchLastLogin(): Promise<void> {
    // 单测不关心最后登录时间
  }

  async listUserCodesByPermission(): Promise<string[]> {
    return this.adminUserCodes
  }
}

export class FakeAccountRequestRepository implements AccountRequestRepositoryPort {
  readonly rows: AccountRequestRecord[] = []

  async hasPending(account: string): Promise<boolean> {
    return this.rows.some((row) => row.account === account && row.status === 'SUBMITTED')
  }

  async findById(id: string): Promise<AccountRequestRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null
  }

  async create(input: CreateAccountRequestInput): Promise<AccountRequestRecord> {
    const record: AccountRequestRecord = {
      id: `req-${this.rows.length + 1}`,
      ...input,
      status: 'SUBMITTED',
      submittedAt: new Date('2026-08-08T10:00:00Z'),
      decidedAt: null,
      decidedBy: null,
      rejectReason: null,
      version: 0,
    }
    this.rows.push(record)
    return record
  }

  async listByStatus(): Promise<AccountRequestRecord[]> {
    return this.rows
  }

  async decide(input: DecideAccountRequestInput): Promise<boolean> {
    const row = this.rows.find((item) => item.id === input.id && item.version === input.version)
    if (!row || row.status !== 'SUBMITTED') return false
    row.status = input.status
    row.version += 1
    return true
  }
}

export class FakeUserCodeRepository implements UserCodeRepositoryPort {
  readonly issued = new Set<string>()

  async isIssued(code: string): Promise<boolean> {
    return this.issued.has(code)
  }

  async tryIssue(code: string): Promise<boolean> {
    if (this.issued.has(code)) return false
    this.issued.add(code)
    return true
  }
}
