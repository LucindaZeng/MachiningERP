import { IsInt, IsString, MaxLength, MinLength } from 'class-validator'

/** 申报回执归档（EXP-04）。回执挂在当前申报版本上，每一版各有各的回执。 */
export class ArchiveReceiptDto {
  @IsInt() versionLock!: number
  @IsString() @MinLength(1) @MaxLength(64) receiptNo!: string
}
