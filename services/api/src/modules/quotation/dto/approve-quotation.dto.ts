import { IsDateString, IsInt, IsOptional } from 'class-validator'

export class ApproveQuotationDto {
  @IsInt() versionLock!: number
  /** 报价有效期。不传则按默认 30 天。 */
  @IsOptional() @IsDateString() validUntil?: string | null
}
