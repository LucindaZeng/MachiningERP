import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

import type { LoginAudience } from '@machining-erp/shared'

export class LoginDto {
  @IsIn(['internal', 'portal'])
  audience!: LoginAudience

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  account!: string

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  captchaId?: string

  @IsOptional()
  @IsString()
  @MaxLength(16)
  captchaCode?: string
}
