import { IsIn, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator'

import { DISPOSITION_VALUES } from '../constants/return-filters'

/**
 * 逐行处置方案（RMA-03）。
 *
 * `allowanceMinor` 只有让步接收用，且必须填：减多少是与客户谈出来的，
 * 系统推算不出来。退款 / 让步 / 报废还必须写 `dispositionNote`。
 */
export class DispositionLineDto {
  @IsString() lineId!: string
  @IsIn(DISPOSITION_VALUES) disposition!: (typeof DISPOSITION_VALUES)[number]
  @IsOptional() @IsString() @MaxLength(500) dispositionNote?: string | null
  @IsOptional() @IsNumberString() allowanceMinor?: string | null
}
