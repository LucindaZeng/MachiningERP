import { Type } from 'class-transformer'
import { IsArray, IsInt, ValidateNested } from 'class-validator'

import { ReceiveGoodsLineDto } from './receive-goods-line.dto'

/** RMA-04 退货入库登记。返工的行必须先过这一步才能结案。 */
export class ReceiveGoodsDto {
  @IsInt() versionLock!: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveGoodsLineDto)
  lines!: ReceiveGoodsLineDto[]
}
