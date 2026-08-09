import { IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * 阶梯价一档。
 *
 * `unitPriceMinor` 用**字符串**传：JSON 没有 bigint，用 number 传分值迟早踩到
 * 2^53 与浮点。这里也**不接受** unitCostMinor——单件成本由后端从成本分析推导。
 */
export class QuotationTierDto {
  @IsNumberString() minQuantity!: string
  @IsNumberString() unitPriceMinor!: string
  @IsOptional() @IsString() @MaxLength(32) label?: string | null
}
