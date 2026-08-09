import { Type } from 'class-transformer'
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'

import { QuotationTierDto } from './quotation-tier.dto'

export class QuotationItemDto {
  @IsInt() sequence!: number
  @IsString() @MaxLength(128) productName!: string
  @IsString() @MaxLength(128) drawingNo!: string

  /** 业务规格 2.2：报价单强制上传图纸。为空时 service 层会挡下并列出缺图纸的行。 */
  @IsOptional() @IsString() drawingVersionId?: string | null
  @IsOptional() @IsString() @MaxLength(32) revision?: string | null
  @IsOptional() @IsString() @MaxLength(64) material?: string | null
  @IsOptional() @IsString() @MaxLength(64) finishing?: string | null
  @IsOptional() @IsString() @MaxLength(64) process?: string | null
  @IsOptional() @IsString() costAnalysisLineId?: string | null
  @IsOptional() @IsString() @MaxLength(255) remark?: string | null

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => QuotationTierDto)
  tiers!: QuotationTierDto[]
}
