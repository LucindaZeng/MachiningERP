import { IsInt, IsString, MaxLength, MinLength } from 'class-validator'

/** 财务开票回填：发票号必填，来自税控系统。 */
export class IssueInvoiceDto {
  @IsInt() versionLock!: number
  @IsString() @MinLength(1) @MaxLength(64) invoiceNo!: string
}
