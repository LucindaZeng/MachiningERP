import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

import type { LoginAudience } from '@machining-erp/shared'

export class PasswordResetRequestDto {
  @IsIn(['internal', 'portal'])
  audience!: LoginAudience

  @IsString()
  @MaxLength(32)
  account!: string

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  applicantName!: string

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  department!: string

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  contact!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}
