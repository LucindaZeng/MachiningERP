import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator'

import { ImpactItemDto } from './impact-item.dto'

/** 工程影响评估（ECN-02）。四项整表提交。 */
export class AssessImpactDto {
  @IsInt() @Min(0) versionLock!: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImpactItemDto)
  impacts!: ImpactItemDto[]

  /**
   * 对生产有无影响（规格第 6 章新增规则）。**必填**。
   * 用 `IsString` 而不是 `IsIn`：无法识别的值要由服务端给出中文说明，
   * class-validator 只会说「必须是以下值之一」。
   */
  @IsString() productionImpact!: string

  @IsBoolean() routingUpdated!: boolean
  @IsOptional() @IsString() @MaxLength(64) effectiveBatch?: string | null
  @IsBoolean() needRequote!: boolean
  @IsBoolean() needOrderReapproval!: boolean
}
