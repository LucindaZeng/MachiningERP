import { IsArray, IsNumberString, IsOptional, IsString, ArrayNotEmpty } from 'class-validator'

/**
 * 建发票申请：只选客户与出货单。
 * 金额、税率、发票种类、抬头税号地址一律由后端自动带出——手填这些是开错票的入口。
 */
export class CreateInvoiceRequestDto {
  @IsString() customerId!: string
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) shipmentIds!: string[]
  @IsOptional() @IsString() statementId?: string
  /** 对账单上对应的入账金额，用于三方一致性比对 */
  @IsOptional() @IsNumberString() statementTotalMinor?: string
}
