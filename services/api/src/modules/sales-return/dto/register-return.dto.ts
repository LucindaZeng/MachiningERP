import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'

import { RegisterReturnLineDto } from './register-return-line.dto'

/** 登记客诉 / 退货（RMA-01）。关联原出货单，客户与订单由出货单带出。 */
export class RegisterReturnDto {
  @IsString() shipmentId!: string
  @IsString() @MaxLength(500) reason!: string
  @IsDateString() complaintAt!: string
  @IsOptional() @IsString() @MaxLength(32) eightDNo?: string | null
  @IsOptional() @IsBoolean() eightDRequired?: boolean

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegisterReturnLineDto)
  lines!: RegisterReturnLineDto[]
}
