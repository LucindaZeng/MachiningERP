import { Inject, Injectable } from '@nestjs/common'

import { USER_REPOSITORY, type UserRecord, type UserRepositoryPort } from '../repositories/user.repository.port'

import type { LoginAudience } from '@prisma/client'


/**
 * 用户查询门面：auth 模块通过本服务读用户，不直接碰 identity 的仓储
 * （development-guide 3.5 跨模块只走 index.ts 导出）。
 */
@Injectable()
export class UserDirectoryService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort) {}

  findForLogin(audience: LoginAudience, account: string): Promise<UserRecord | null> {
    return this.users.findForLogin(audience, account)
  }

  findByUserCode(userCode: string): Promise<UserRecord | null> {
    return this.users.findByUserCode(userCode)
  }

  touchLastLogin(userId: string, at: Date = new Date()): Promise<void> {
    return this.users.touchLastLogin(userId, at)
  }

  listUserCodesByPermission(permissionCode: string): Promise<string[]> {
    return this.users.listUserCodesByPermission(permissionCode)
  }
}
