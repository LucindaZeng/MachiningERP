import { IsInt } from 'class-validator'

import { BomRequestPayloadDto } from './bom-request-payload.dto'

export class UpdateBomRequestDto extends BomRequestPayloadDto {
  @IsInt() versionLock!: number
}
