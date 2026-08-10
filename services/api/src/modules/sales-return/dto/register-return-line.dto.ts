import { IsInt, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * 退货明细行入参（登记时）。**必须挂在原出货行上**——
 * 脱离出货行就没有批次追溯，也校验不出「退的比发的还多」。
 *
 * 登记时不收责任归属与处置方式：那是品质与业务后两步的事。
 */
export class RegisterReturnLineDto {
  @IsInt() sequence!: number
  @IsString() shipmentLineId!: string
  @IsOptional() @IsString() orderLineId?: string | null

  @IsString() @MaxLength(128) productName!: string
  @IsString() @MaxLength(128) drawingNo!: string
  @IsString() @MaxLength(64) batchNo!: string

  @IsNumberString() returnQty!: string
  @IsNumberString() unitPriceMinor!: string
  @IsNumberString() amountMinor!: string

  @IsString() @MaxLength(500) reason!: string
}
