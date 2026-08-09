import { Injectable } from '@nestjs/common'


import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreateUserInput,
  ReleasedAccountRecord,
  UserRecord,
  UserRepositoryPort,
} from './user.repository.port'
import type { LoginAudience, Prisma } from '@prisma/client'

const USER_INCLUDE = {
  department: { select: { name: true } },
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
} satisfies Prisma.UserInclude

type UserWithRelations = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>

function toRecord(user: UserWithRelations): UserRecord {
  const roleCodes = user.roles.map((link) => link.role.code)
  const permissionCodes = [
    ...new Set(
      user.roles.flatMap((link) => link.role.permissions.map((item) => item.permission.code)),
    ),
  ]

  return {
    id: user.id,
    userCode: user.userCode,
    account: user.account,
    audience: user.audience,
    formerAccount: user.formerAccount,
    displayName: user.displayName,
    departmentName: user.department?.name ?? null,
    passwordHash: user.passwordHash,
    status: user.status,
    employmentStatus: user.employmentStatus,
    leftAt: user.leftAt,
    roleCodes,
    permissionCodes,
  }
}

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findForLogin(audience: LoginAudience, account: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: { audience, account, deletedAt: null },
      include: USER_INCLUDE,
    })
    return user ? toRecord(user) : null
  }

  async findByUserCode(userCode: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { userCode }, include: USER_INCLUDE })
    return user ? toRecord(user) : null
  }

  async isAccountInUse(audience: LoginAudience, account: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { audience, account, deletedAt: null, employmentStatus: 'ACTIVE' },
    })
    return count > 0
  }

  async findReleasedAccount(account: string): Promise<ReleasedAccountRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: { formerAccount: account, employmentStatus: 'LEFT' },
      orderBy: { accountReleasedAt: 'desc' },
      select: { formerAccount: true, displayName: true, leftAt: true },
    })
    if (!user?.formerAccount) return null

    return { formerAccount: user.formerAccount, formerHolder: user.displayName, leftAt: user.leftAt }
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const user = await this.prisma.user.create({
      data: {
        userCode: input.userCode,
        account: input.account,
        audience: input.audience,
        displayName: input.displayName,
        departmentId: input.departmentId,
        contact: input.contact,
        passwordHash: input.passwordHash,
        status: 'ACTIVE',
        createdBy: input.createdBy,
      },
      include: USER_INCLUDE,
    })
    return toRecord(user)
  }

  async assignRoles(
    userId: string,
    roleCodes: readonly string[],
    grantedBy: string | null,
  ): Promise<void> {
    if (roleCodes.length === 0) return

    const roles = await this.prisma.role.findMany({
      where: { code: { in: [...roleCodes] } },
      select: { id: true },
    })

    await this.prisma.userRole.createMany({
      data: roles.map((role) => ({ userId, roleId: role.id, grantedBy })),
      skipDuplicates: true,
    })
  }

  async touchLastLogin(userId: string, at: Date): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: at } })
  }

  async listUserCodesByPermission(permissionCode: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        employmentStatus: 'ACTIVE',
        roles: { some: { role: { permissions: { some: { permission: { code: permissionCode } } } } } },
      },
      select: { userCode: true },
    })
    return users.map((user) => user.userCode)
  }
}
