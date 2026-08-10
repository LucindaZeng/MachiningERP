import { IsInt, IsString, MaxLength, MinLength } from 'class-validator'

/** 驳回理由必填：要原样回到业务员的工作台。 */
export class RejectOrderDto {
  @IsInt() versionLock!: number
  @IsString() @MinLength(1) @MaxLength(500) reason!: string
}
