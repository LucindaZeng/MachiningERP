import { IsInt } from 'class-validator'

import { CreateSalesOrderDto } from './create-sales-order.dto'

/** 整单替换草稿；versionLock 必传，服务端据此做乐观锁。 */
export class UpdateSalesOrderDto extends CreateSalesOrderDto {
  @IsInt() versionLock!: number
}
