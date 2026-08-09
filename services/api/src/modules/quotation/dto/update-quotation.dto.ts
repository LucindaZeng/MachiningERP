import { IsInt } from 'class-validator'

import { CreateQuotationDto } from './create-quotation.dto'

/** 整单替换草稿。versionLock 必传，服务端据此做乐观锁。 */
export class UpdateQuotationDto extends CreateQuotationDto {
  @IsInt() versionLock!: number
}
