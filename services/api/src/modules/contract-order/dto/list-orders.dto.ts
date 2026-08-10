import { IsIn, IsOptional, IsString } from 'class-validator'

import { ORDER_STATUS_VALUES, ORDER_TYPE_VALUES } from '../constants/order-filters'

import type { OrderStatusFilter, OrderTypeFilter } from '../constants/order-filters'

/** 列表查询条件；枚举值住在 constants/，controller 不必为拿枚举去 import @prisma/client。 */
export class ListOrdersDto {
  @IsOptional() @IsString() customerId?: string
  @IsOptional() @IsIn(ORDER_TYPE_VALUES) orderType?: OrderTypeFilter
  @IsOptional() @IsIn(ORDER_STATUS_VALUES) status?: OrderStatusFilter
}
