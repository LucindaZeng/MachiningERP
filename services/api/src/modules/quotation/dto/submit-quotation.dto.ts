import { IsInt, IsString } from 'class-validator'

export class SubmitQuotationDto {
  @IsInt() versionLock!: number
  /** 审核人（业务经理）的唯一编码，决定待办通知发给谁 */
  @IsString() approverUserCode!: string
}
