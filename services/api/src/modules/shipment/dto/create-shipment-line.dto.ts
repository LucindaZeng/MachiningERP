import { IsInt, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * 出货明细行入参。**必须挂在订单行上**——脱离订单行的出货行
 * 无法回写订单进度，也无法算尾数。
 */
export class CreateShipmentLineDto {
  @IsInt() sequence!: number
  @IsString() orderLineId!: string

  @IsString() @MaxLength(128) productName!: string
  @IsString() @MaxLength(128) drawingNo!: string
  @IsOptional() @IsString() @MaxLength(16) itemCode?: string | null
  @IsString() @MaxLength(64) batchNo!: string

  @IsNumberString() orderedQty!: string
  @IsNumberString() qualifiedQty!: string
  @IsNumberString() packedQty!: string
  @IsNumberString() shippedQty!: string
  @IsNumberString() unitPriceMinor!: string
}
