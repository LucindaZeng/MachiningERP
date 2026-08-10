import { IsIn, IsString } from 'class-validator'

import { RESPONSIBILITY_VALUES } from '../constants/return-filters'

/** 品质逐行判定责任归属（RMA-02）。 */
export class JudgeReturnLineDto {
  @IsString() lineId!: string
  @IsIn(RESPONSIBILITY_VALUES) responsibility!: (typeof RESPONSIBILITY_VALUES)[number]
}
