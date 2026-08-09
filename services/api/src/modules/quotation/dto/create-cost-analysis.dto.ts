import { Type } from 'class-transformer'
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator'

import { CostAnalysisLineDto } from './cost-analysis-line.dto'

import type { CurrencyCode } from '@machining-erp/shared'


const CURRENCIES = ['CNY', 'USD', 'HKD', 'EUR', 'JPY'] as const

export class CreateCostAnalysisDto {
  @IsString() customerId!: string
  @IsString() @MaxLength(128) productModel!: string

  /** 损耗率/管理费率/税率按万分比，默认 500/500/1300（即 5%/5%/13%） */
  @IsOptional() @IsInt() lossBps?: number
  @IsOptional() @IsInt() overheadBps?: number
  @IsOptional() @IsInt() vatBps?: number
  @IsOptional() @IsIn(CURRENCIES) currency?: CurrencyCode

  @IsOptional() @IsArray() processColumns?: Array<{ key: string; label: string }>

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CostAnalysisLineDto)
  lines!: CostAnalysisLineDto[]
}
