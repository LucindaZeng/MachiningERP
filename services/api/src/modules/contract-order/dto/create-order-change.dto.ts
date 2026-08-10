import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

import { ALLOWED_CHANGE_TYPES } from '../constants/order-change-rules'

import type { OrderChangeType } from '@prisma/client'

/**
 * 订单修改申请。
 *
 * `changeType` 只接受白名单里的五种——改价、换产品、改图纸这类诉求
 * 在 DTO 这一层就被 `@IsIn` 挡住，service 层还有一道同样的闸门。
 */
export class CreateOrderChangeDto {
  @IsString() orderId!: string
  @IsOptional() @IsString() orderLineId?: string | null

  @IsIn(ALLOWED_CHANGE_TYPES) changeType!: OrderChangeType
  @IsIn(['customer', 'internal']) origin!: 'customer' | 'internal'
  @IsOptional() @IsBoolean() urgent?: boolean

  @IsString() @MaxLength(255) beforeValue!: string
  @IsString() @MaxLength(255) afterValue!: string
  @IsString() @MinLength(1) @MaxLength(500) reason!: string
  @IsOptional() @IsString() @MaxLength(64) costOwner?: string | null
}
