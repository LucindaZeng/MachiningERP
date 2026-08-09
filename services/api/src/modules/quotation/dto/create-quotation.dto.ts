import { Type } from 'class-transformer'
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

import { QUOTATION_TEMPLATES } from '../constants/quotation-terms'

import { QuotationItemDto } from './quotation-item.dto'

import type { QuotationTerms } from '../constants/quotation-terms'

const CURRENCIES = ['CNY', 'USD', 'HKD', 'EUR', 'JPY'] as const

export class CreateQuotationDto {
  @IsString() customerId!: string
  /** 硬校验：无成本分析不能建单 */
  @IsString() costAnalysisId!: string

  @IsOptional() @IsIn(QUOTATION_TEMPLATES) template?: string
  @IsOptional() @IsIn(CURRENCIES) currency?: string
  /** 国外报价的当日汇率快照（百万分比整数，字符串传） */
  @IsOptional() @IsNumberString() fxRateMicros?: string | null
  @IsOptional() @IsDateString() fxQuotedOn?: string | null
  /** 模具费单列，不摊入单件价 */
  @IsOptional() @IsNumberString() moldFeeMinor?: string
  @IsOptional() @IsObject() terms?: QuotationTerms | null

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  items!: QuotationItemDto[]
}
