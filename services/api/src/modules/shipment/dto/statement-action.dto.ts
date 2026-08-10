import { IsInt } from 'class-validator'

/** 发出 / 确认 / 结清：只需要乐观锁版本。 */
export class StatementActionDto {
  @IsInt() versionLock!: number
}
