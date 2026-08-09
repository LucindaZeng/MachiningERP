import { IsString, MaxLength, MinLength } from 'class-validator'

export class RejectChangeRequestDto {
  /** 驳回必须填写理由，理由要回到提交人手上 */
  @IsString() @MinLength(1) @MaxLength(500) reason!: string
}
