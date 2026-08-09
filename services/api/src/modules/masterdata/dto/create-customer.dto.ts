import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'

import { DeliveryAddressDto } from './delivery-address.dto'

const REGIONS = ['DOMESTIC', 'OVERSEAS'] as const
const PAYMENT_TERMS = [
  'DEPOSIT_THEN_BALANCE',
  'CASH_BEFORE_SHIPMENT',
  'NET_30',
  'NET_60',
  'NET_90',
] as const

export class CreateCustomerDto {
  @IsString() @MinLength(1) @MaxLength(128) name!: string
  @IsString() @MinLength(1) @MaxLength(64) shortName!: string
  @IsIn(REGIONS) region!: (typeof REGIONS)[number]
  @IsString() @MinLength(1) @MaxLength(64) country!: string

  @IsOptional() @IsString() @MaxLength(128) englishName?: string
  @IsOptional() @IsString() @MaxLength(255) englishAddress?: string

  @IsString() @MinLength(1) @MaxLength(64) ownerName!: string
  @IsString() @MinLength(1) @MaxLength(64) ownerPhone!: string
  @IsOptional() @IsString() @MaxLength(128) ownerEmail?: string
  @IsOptional() @IsString() @MaxLength(32) salesUserCode?: string

  @IsOptional() @IsString() @MaxLength(64) taxNo?: string
  @IsString() @MinLength(1) @MaxLength(255) invoiceAddress!: string
  @IsOptional() @IsString() @MaxLength(64) bankAccount?: string
  @IsOptional() @IsString() @MaxLength(128) bankName?: string

  @IsIn(PAYMENT_TERMS) paymentTerm!: (typeof PAYMENT_TERMS)[number]
  @IsOptional() @IsInt() depositBps?: number
  @IsIn(['GENERAL', 'SPECIAL']) invoiceType!: 'GENERAL' | 'SPECIAL'
  @IsIn(['CASH', 'NOTE']) settlement!: 'CASH' | 'NOTE'
  @IsOptional() @IsString() @MaxLength(8) currency?: string
  @IsOptional() @IsString() @MaxLength(64) tradeTerm?: string
  @IsOptional() @IsString() @MaxLength(32) level?: string

  @IsOptional() @IsBoolean() hkPricingEnabled?: boolean
  @IsOptional() @IsInt() hkFactorBps?: number
  @IsOptional() @IsString() @MaxLength(32) hkEffectiveFrom?: string
  @IsOptional() @IsString() @MaxLength(255) hkChangeReason?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryAddressDto)
  addresses!: DeliveryAddressDto[]

  @IsOptional() @IsBoolean() draft?: boolean
}
