import { IsInt, IsNumberString } from 'class-validator'

/** 业务希望改到的目标价：按「产品行序号 + 起订量」定位到某一档。 */
export class QuoteTargetPriceDto {
  @IsInt() itemSequence!: number
  @IsNumberString() minQuantity!: string
  @IsNumberString() targetPriceMinor!: string
}
