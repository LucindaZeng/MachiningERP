import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator'

import { RETURN_STATUS_VALUES } from '../constants/return-filters'

import type { ReturnStatusFilter } from '../constants/return-filters'

/** 列表查询条件；枚举值住在 constants/，controller 不必去 import @prisma/client。 */
export class ListReturnsDto {
  @IsOptional() @IsString() customerId?: string
  @IsOptional() @IsString() orderId?: string
  @IsOptional() @IsString() shipmentId?: string
  @IsOptional() @IsIn(RETURN_STATUS_VALUES) status?: ReturnStatusFilter
  @IsOptional() @IsString() ownerUserCode?: string
  @IsOptional() @IsDateString() closedFrom?: string
  @IsOptional() @IsDateString() closedTo?: string
}
