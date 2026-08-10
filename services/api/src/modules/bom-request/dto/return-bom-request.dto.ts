import { IsInt, IsString, MaxLength, MinLength } from 'class-validator'

/** 工程退回：必须写明缺什么，业务员才知道要补什么。 */
export class ReturnBomRequestDto {
  @IsInt() versionLock!: number
  @IsString() @MinLength(1) @MaxLength(500) reason!: string
}
