import { AUTH_ERRORS, type PermissionCode } from '@machining-erp/shared'
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { REQUIRED_PERMISSIONS_KEY } from '../../../common/decorators/require-permissions.decorator'
import { BizError } from '../../../common/errors/biz-error'

import type { Request } from 'express'

/**
 * 权限点校验。成本核算、客户财务字段等都是独立权限点，
 * 未授予者一律拒绝——字段级隐藏另由序列化层裁剪。
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const user = context.switchToHttp().getRequest<Request>().user
    if (!user) {
      throw new BizError(AUTH_ERRORS.TOKEN_INVALID)
    }

    const missing = required.filter((code) => !user.permissions.includes(code))
    if (missing.length > 0) {
      throw new BizError(AUTH_ERRORS.FORBIDDEN, {
        message: `缺少权限：${missing.join('、')}`,
        details: { missing },
      })
    }

    return true
  }
}
