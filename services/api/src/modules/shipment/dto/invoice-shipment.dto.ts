import { IsInt, IsString, MaxLength } from 'class-validator'

/** 开票回填（SHP-06）：发票号由财务开出后写回，供对账单勾稽。 */
export class InvoiceShipmentDto {
  @IsInt() versionLock!: number
  @IsString() @MaxLength(32) invoiceNo!: string
}
