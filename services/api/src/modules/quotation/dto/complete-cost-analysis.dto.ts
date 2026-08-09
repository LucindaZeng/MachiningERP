import { IsString, MaxLength } from 'class-validator'

export class CompleteCostAnalysisDto {
  /** 核价完成后要通知的业务员唯一编码 */
  @IsString() @MaxLength(32) salesUserCode!: string
}
