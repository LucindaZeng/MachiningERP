import { IsInt } from 'class-validator'

/** 批准订单修改申请，只需要乐观锁版本。 */
export class HandleOrderChangeDto {
  @IsInt() versionLock!: number
}
