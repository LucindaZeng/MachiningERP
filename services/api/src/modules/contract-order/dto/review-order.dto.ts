import { IsInt } from 'class-validator'

/** 送审 / 通过当前审核节点，只需要乐观锁版本。 */
export class ReviewOrderDto {
  @IsInt() versionLock!: number
}
