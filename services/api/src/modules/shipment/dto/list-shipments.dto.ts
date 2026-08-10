import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator'

import { SHIPMENT_STATUS_VALUES } from '../constants/shipment-filters'

import type { ShipmentStatusFilter } from '../constants/shipment-filters'

/** 列表查询条件；枚举值住在 constants/，controller 不必去 import @prisma/client。 */
export class ListShipmentsDto {
  @IsOptional() @IsString() customerId?: string
  @IsOptional() @IsString() orderId?: string
  @IsOptional() @IsIn(SHIPMENT_STATUS_VALUES) status?: ShipmentStatusFilter
  @IsOptional() @IsString() ownerUserCode?: string
  @IsOptional() @IsDateString() shippedFrom?: string
  @IsOptional() @IsDateString() shippedTo?: string
}
