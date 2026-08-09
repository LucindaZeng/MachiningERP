import { AUTH_ERRORS } from '@machining-erp/shared'
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator'
import { BizError } from '../../../common/errors/biz-error'
import { AccessTokenService } from '../services/access-token.service'

import type { Request } from 'express'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<Request>()
    const token = extractBearer(request.header('authorization'))
    if (!token) {
      throw new BizError(AUTH_ERRORS.TOKEN_INVALID, { message: '缺少 Authorization: Bearer <JWT>' })
    }

    const claims = await this.tokens.verify(token)
    request.user = {
      userId: claims.uid,
      userCode: claims.sub,
      audience: claims.aud,
      displayName: claims.name,
      department: claims.dept,
      roles: claims.roles,
      permissions: claims.perms,
      tokenId: claims.jti,
    }

    return true
  }
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, value] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' && value ? value : null
}
