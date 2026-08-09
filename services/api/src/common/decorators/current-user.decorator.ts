import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { AuthenticatedUser } from '../types/authenticated-user'
import type { Request } from 'express'


export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined =>
    context.switchToHttp().getRequest<Request>().user,
)
