import { IsNumberString, IsString } from 'class-validator'

/** 逐行登记不良品实物入库（不良仓）。 */
export class ReceiveGoodsLineDto {
  @IsString() lineId!: string
  @IsNumberString() receivedQty!: string
}
