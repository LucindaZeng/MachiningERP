import { SetMetadata, type CustomDecorator } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'auth:isPublic'

/** 标记无需登录即可访问的端点（登录、验证码、账户申请、忘记密码）。 */
export function Public(): CustomDecorator<string> {
  return SetMetadata(IS_PUBLIC_KEY, true)
}
