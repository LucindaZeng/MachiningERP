import { IsInt } from 'class-validator'

/** 只推进节点的动作（送审 / 复核通过 / 退回 / 申报 / 放行）：只需要乐观锁版本。 */
export class CustomsActionDto {
  @IsInt() versionLock!: number
}
