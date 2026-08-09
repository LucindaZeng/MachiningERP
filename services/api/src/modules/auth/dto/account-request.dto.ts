import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class AccountRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  employeeName!: string

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  department!: string

  @IsString()
  @MaxLength(32)
  account!: string

  @IsString()
  @MaxLength(128)
  password!: string

  @IsString()
  @MaxLength(128)
  confirmPassword!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contact?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}
