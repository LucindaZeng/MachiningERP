import { IsOptional, IsString, MaxLength } from 'class-validator'

/** 一条影响评估。金额允许为空——评不出钱与评出零是两回事。 */
export class ImpactItemDto {
  @IsString() scope!: string
  @IsString() @MaxLength(128) quantity!: string
  @IsOptional() @IsString() amountMinor?: string | null
  @IsString() @MaxLength(500) note!: string
}
