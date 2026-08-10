import { IsInt } from 'class-validator'

/** 只推进节点的动作（拣配 / 包装 / 签收 / 结案）：只需要乐观锁版本。 */
export class ShipmentActionDto {
  @IsInt() versionLock!: number
}
