import { IsInt, Min } from 'class-validator'

/** 只带乐观锁的流转动作。 */
export class EcnActionDto {
  @IsInt() @Min(0) versionLock!: number
}
