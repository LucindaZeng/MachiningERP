import { IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator'

/** 成本分析明细行入参。金额用整数分字符串，重量用 decimal 字符串。 */
export class CostAnalysisLineDto {
  @IsInt() @Min(1) sequence!: number
  @IsString() @MaxLength(32) blankType!: string
  @IsString() @MaxLength(128) drawingNo!: string
  @IsOptional() @IsString() drawingVersionId!: string | null
  @IsString() @MaxLength(64) spec!: string
  @IsOptional() @IsString() @MaxLength(32) revision!: string | null
  @IsString() quantity!: string
  @IsString() @MaxLength(64) material!: string
  @IsString() estimatedWeightKg!: string
  @IsString() netWeightKg!: string
  @IsString() scrapWeightKg!: string
  @IsString() scrapUnitPriceMinor!: string
  @IsString() materialUnitPriceMinor!: string
  @IsBoolean() materialPriceOverridden!: boolean
  @IsOptional() @IsString() materialPriceSourceId!: string | null
  @IsString() @MaxLength(32) machiningMethod!: string
  @IsString() machiningMinutes!: string
  @IsString() machiningCostMinor!: string
  @IsObject() processCosts!: Record<string, string>
  @IsOptional() @IsString() @MaxLength(255) remark!: string | null
}
