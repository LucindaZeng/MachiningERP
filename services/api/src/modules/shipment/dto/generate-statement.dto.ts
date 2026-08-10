import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator'

const BASES = ['SHIPMENT', 'INVOICE'] as const

/**
 * 生成（或重算）某客户某期间的对账单。
 * 重算不会改已有版本，而是产出新版本——已发出的对账单是客户签回的凭据。
 */
export class GenerateStatementDto {
  @IsString() customerId!: string
  @IsDateString() periodFrom!: string
  @IsDateString() periodTo!: string
  /** 期末余额口径：发货制（默认）或开票制 */
  @IsOptional() @IsIn(BASES) basis?: (typeof BASES)[number]
  /** 客户账面期末余额；给了才算差异 */
  @IsOptional() @IsString() customerClosingMinor?: string | null
}
