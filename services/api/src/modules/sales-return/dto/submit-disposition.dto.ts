import { Type } from 'class-transformer'
import { IsArray, IsInt, ValidateNested } from 'class-validator'

import { DispositionLineDto } from './disposition-line.dto'

/** RMA-03 提交处置方案：是否需要财务审批由处置组合推导，前端勾不了。 */
export class SubmitDispositionDto {
  @IsInt() versionLock!: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispositionLineDto)
  lines!: DispositionLineDto[]
}
