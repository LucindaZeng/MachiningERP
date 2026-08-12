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

  @IsBoolean() routingUpdated!: boolean
  @IsOptional() @IsString() @MaxLength(64) effectiveBatch?: string | null
  @IsBoolean() needRequote!: boolean
  @IsBoolean() needOrderReapproval!: boolean
}
