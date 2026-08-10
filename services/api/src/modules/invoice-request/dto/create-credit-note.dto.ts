import { IsNumberString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

/** 红冲：理由必填；不传金额时按原票全额冲。 */
export class CreateCreditNoteDto {
  @IsString() @MinLength(1) @MaxLength(500) reason!: string
  @IsOptional() @IsNumberString() amountIncTaxMinor?: string
}
