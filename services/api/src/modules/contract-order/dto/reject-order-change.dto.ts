import { IsInt, IsString, MaxLength, MinLength } from 'class-validator'

/** 驳回订单修改申请：理由必填，回到提交人工作台。 */
export class RejectOrderChangeDto {
  @IsInt() versionLock!: number
  @IsString() @MinLength(1) @MaxLength(500) reason!: string
}
