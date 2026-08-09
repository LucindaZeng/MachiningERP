import { IsInt, IsString, MaxLength, MinLength } from 'class-validator'

/** 驳回修改申请：理由必填（业务规格 2.4）。 */
export class RejectQuoteChangeDto {
  @IsInt() versionLock!: number
  @IsString() @MinLength(1) @MaxLength(500) reason!: string
}
