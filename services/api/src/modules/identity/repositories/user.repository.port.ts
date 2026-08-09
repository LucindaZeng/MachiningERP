import type { EmploymentStatus, LoginAudience, UserStatus } from '@prisma/client'

export interface UserRecord {
  id: string
  userCode: string
  account: string | null
  audience: LoginAudience
  formerAccount: string | null
  displayName: string
  departmentName: string | null
  passwordHash: string
  status: UserStatus
  employmentStatus: EmploymentStatus
  leftAt: Date | null
  roleCodes: string[]
  permissionCodes: string[]
}

/** 离职释放出来的用户名及其原使用人，用于「该用户名原由某某使用」的提示 */
export interface ReleasedAccountRecord {
  formerAccount: string
  formerHolder: string
  leftAt: Date | null
}

export interface CreateUserInput {
  userCode: string
  account: string
  audience: LoginAudience
  displayName: string
  departmentId: string | null
  contact: string | null
  passwordHash: string
  createdBy: string | null
}

export interface UserRepositoryPort {
  findForLogin(audience: LoginAudience, account: string): Promise<UserRecord | null>
  findByUserCode(userCode: string): Promise<UserRecord | null>
  /** 在职且正在使用该用户名的账号（离职后 account 置空，因此天然不计入） */
  isAccountInUse(audience: LoginAudience, account: string): Promise<boolean>
  findReleasedAccount(account: string): Promise<ReleasedAccountRecord | null>
  create(input: CreateUserInput): Promise<UserRecord>
  assignRoles(userId: string, roleCodes: readonly string[], grantedBy: string | null): Promise<void>
  touchLastLogin(userId: string, at: Date): Promise<void>
  listUserCodesByPermission(permissionCode: string): Promise<string[]>
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY')
