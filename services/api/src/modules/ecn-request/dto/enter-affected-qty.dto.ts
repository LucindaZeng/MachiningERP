import { Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsInt, Min, ValidateNested } from 'class-validator'

import { AffectedLineDto } from './affected-line.dto'

/** PMC 清点后整表录入受影响数量。空数组无意义——那等于没清点。 */
export class EnterAffectedQtyDto {
  @IsInt() @Min(0) versionLock!: number

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AffectedLineDto)
  lines!: AffectedLineDto[]
}
