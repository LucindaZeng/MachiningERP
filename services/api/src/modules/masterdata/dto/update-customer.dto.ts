import { Type } from 'class-transformer'
import { IsArray, IsInt, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator'

import { DeliveryAddressDto } from './delivery-address.dto'

export class UpdateCustomerDto {
  /** 乐观锁版本（api-conventions.md「乐观锁」），冲突返回 409 */
  @IsInt() version!: number

  /** 待更新字段。命中敏感字段会转成变更申请而不是直接生效。 */
  @IsObject() patch!: Record<string, string | number | boolean | null>

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryAddressDto)
  addresses?: DeliveryAddressDto[]

  @IsOptional() @IsString() @MaxLength(500) reason?: string
}
