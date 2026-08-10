import { IsInt } from 'class-validator'

/** 只推进节点的动作（批准 / 结案 / 首响打点）：只需要乐观锁版本。 */
export class ReturnActionDto {
  @IsInt() versionLock!: number
}
