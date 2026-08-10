import { IsInt, IsString, MaxLength, MinLength } from 'class-validator'

/**
 * 客户提出对账差异。差异说明必填——
 * 没有说明的差异会在月复一月的对账里沉下去，最后没人说得清是哪一笔。
 */
export class DisputeStatementDto {
  @IsInt() versionLock!: number
  @IsString() @MinLength(1) @MaxLength(500) differenceNote!: string
}
