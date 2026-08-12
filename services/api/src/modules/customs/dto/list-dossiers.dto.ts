import { IsIn, IsOptional, IsString } from 'class-validator'

import { CUSTOMS_STATUS_VALUES } from '../constants/customs-filters'

import type { CustomsStatusFilter } from '../constants/customs-filters'

/** 列表查询条件；枚举值住在 constants/，controller 不必去 import @prisma/client。 */
export class ListDossiersDto {
  @IsOptional() @IsString() customerId?: string
  @IsOptional() @IsString() shipmentId?: string
  @IsOptional() @IsString() orderId?: string
  @IsOptional() @IsIn(CUSTOMS_STATUS_VALUES) status?: CustomsStatusFilter
  @IsOptional() @IsString() ownerUserCode?: string
}
