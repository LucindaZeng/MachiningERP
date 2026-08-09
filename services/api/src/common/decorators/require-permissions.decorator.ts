import { SetMetadata, type CustomDecorator } from '@nestjs/common'

import type { PermissionCode } from '@machining-erp/shared'

export const REQUIRED_PERMISSIONS_KEY = 'auth:requiredPermissions'

/**
 * 声明端点所需权限点，例如香港 70% 价格是独立权限点：
 * `@RequirePermissions(PERMISSION_CODES.HK_PRICE_VIEW)`
 */
export function RequirePermissions(...codes: PermissionCode[]): CustomDecorator<string> {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, codes)
}
