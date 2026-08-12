import { IsInt, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator'

/**
 * 建档报关资料（EXP-01）。
 *
 * 客户、订单、币种由后端从**原出货单**带出，不在这里传——
 * 报关单上的数量对不上出货单，是到口岸才会被发现的那种错。
 */
export class CreateDossierDto {
  @IsString() shipmentId!: string

  @IsString() @MaxLength(32) tradeMode!: string
  @IsString() @MaxLength(32) incoterm!: string
  @IsString() @MaxLength(64) portOfLoading!: string
  @IsString() @MaxLength(128) destination!: string
  @IsOptional() @IsString() @MaxLength(16) destinationPortCode?: string | null
  @IsOptional() @IsString() @MaxLength(500) shippingMarks?: string | null

  @IsString() @MaxLength(16) hsCode!: string
  @IsString() @MaxLength(128) goodsNameCn!: string
  @IsOptional() @IsString() @MaxLength(128) goodsNameEn?: string | null

  @IsNumberString() quantity!: string
  @IsString() @MaxLength(16) unit!: string
  @IsNumberString() netWeight!: string
  @IsNumberString() grossWeight!: string
  @IsInt() @Min(0) packages!: number

  @IsNumberString() unitPriceMinor!: string
  @IsNumberString() totalAmountMinor!: string
  /** 当日汇率；每份文件出具时另各留一份快照 */
  @IsNumberString() exchangeRate!: string
}
