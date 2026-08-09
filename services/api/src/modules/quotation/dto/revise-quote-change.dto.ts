import { Type } from 'class-transformer'
import { IsArray, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator'

import { CostAnalysisLineDto } from './cost-analysis-line.dto'

/**
 * 重核：lines 不传则复制原成本分析明细，报价工程师再在新版本上改。
 *
 * 费率三项要么都不传（沿用原版本），要么都传——只改其中一项时另外两项也要显式带上，
 * 免得「只想调损耗」却把管理费悄悄重置成默认值。
 */
export class ReviseQuoteChangeDto {
  @IsInt() versionLock!: number

  @IsOptional() @IsInt() @Min(0) @Max(10_000) lossBps?: number
  @IsOptional() @IsInt() @Min(0) @Max(10_000) overheadBps?: number
  @IsOptional() @IsInt() @Min(0) @Max(10_000) vatBps?: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CostAnalysisLineDto)
  lines?: CostAnalysisLineDto[]
}
