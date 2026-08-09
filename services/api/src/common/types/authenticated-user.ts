import type { LoginAudience } from '@prisma/client'

/** 请求上下文中的当前用户。责任人标识一律用 userCode，不用用户名。 */
export interface AuthenticatedUser {
  userId: string
  userCode: string
  audience: LoginAudience
  displayName: string
  department: string
  roles: string[]
  permissions: string[]
  tokenId: string
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser
  }
}
