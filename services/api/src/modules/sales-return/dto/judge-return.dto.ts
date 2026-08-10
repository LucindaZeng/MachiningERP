import { Type } from 'class-transformer'
import { IsArray, IsInt, ValidateNested } from 'class-validator'

import { JudgeReturnLineDto } from './judge-return-line.dto'

/** RMA-02 品质判定：一次提交整单的逐行责任归属。 */
export class JudgeReturnDto {
  @IsInt() versionLock!: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JudgeReturnLineDto)
  lines!: JudgeReturnLineDto[]
}
