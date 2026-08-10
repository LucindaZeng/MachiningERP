import { IsInt, IsString, MaxLength, MinLength } from 'class-validator'

/** 作废（未开票前）：理由必填。 */
export class VoidInvoiceDto {
  @IsInt() versionLock!: number
  @IsString() @MinLength(1) @MaxLength(500) reason!: string
}
