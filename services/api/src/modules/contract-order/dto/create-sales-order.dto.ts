import { Type } from 'class-transformer'
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

import { SalesOrderLineDto } from './sales-order-line.dto'

import type { ChargeMode, SalesOrderType } from '@prisma/client'

const ORDER_TYPES = ['FORMAL', 'SAMPLE', 'MOLD', 'STOCK_PREP'] as const
const CHARGE_MODES = ['CHARGED', 'FREE', 'PARTIAL', 'DEFERRED', 'DEPOSIT', 'INTERNAL'] as const
const CURRENCIES = ['CNY', 'USD', 'HKD', 'EUR', 'JPY'] as const

export class CreateSalesOrderDto {
  @IsString() customerId!: string
  @IsIn(ORDER_TYPES) orderType!: SalesOrderType
  @IsIn(CHARGE_MODES) chargeMode!: ChargeMode

  /** 模具与正常订单必填；收费样品也必填 */
  @IsOptional() @IsString() customerPoNo?: string | null
  @IsOptional() @IsString() customerPoFile?: string | null

  @IsOptional() @IsIn(CURRENCIES) currency?: string
  @IsOptional() @IsInt() taxRateBps?: number
  /** 备料订单没有客户交期，改填内部要求完成时间 */
  @IsOptional() @IsDateString() internalDueDate?: string | null

  /** 免费或部分收费时三者必填 */
  @IsOptional() @IsString() costOwner?: string | null
  @IsOptional() @IsString() freeReason?: string | null
  @IsOptional() @IsNumberString() estimatedCostMinor?: string | null

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderLineDto)
  lines!: SalesOrderLineDto[]
}
