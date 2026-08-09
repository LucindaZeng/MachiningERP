import { Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator'

import { QuoteTargetPriceDto } from './quote-target-price.dto'

export class CreateQuoteChangeDto {
  @IsString() quotationId!: string
  /** 收到申请的报价工程师唯一编码 */
  @IsString() engineerUserCode!: string
  @IsString() @MinLength(1) @MaxLength(500) reason!: string

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => QuoteTargetPriceDto)
  targetPrices!: QuoteTargetPriceDto[]
}
