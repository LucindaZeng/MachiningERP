import { Type } from 'class-transformer'
import { IsArray, IsInt, ValidateNested } from 'class-validator'

import { CostAnalysisLineDto } from './cost-analysis-line.dto'

export class ReplaceCostLinesDto {
  /** 乐观锁版本，冲突返回 409 */
  @IsInt() versionLock!: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CostAnalysisLineDto)
  lines!: CostAnalysisLineDto[]
}
