import { Type } from 'class-transformer'
import { IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator'

import { CreateShipmentLineDto } from './create-shipment-line.dto'

const CURRENCIES = ['CNY', 'USD', 'HKD', 'EUR', 'JPY'] as const

/** 生成发货通知（SHP-01）。收货地址从客户档案的送货地址里选，不在这里另填地址。 */
export class CreateShipmentDto {
  @IsString() orderId!: string
  @IsString() customerId!: string
  @IsOptional() @IsString() deliveryAddressId?: string | null
  @IsOptional() @IsIn(CURRENCIES) currency?: string
  @IsOptional() @IsString() @MaxLength(128) carrier?: string | null
  @IsOptional() @IsString() @MaxLength(64) trackingNo?: string | null

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateShipmentLineDto)
  lines!: CreateShipmentLineDto[]
}
