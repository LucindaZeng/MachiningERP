import { IsInt } from 'class-validator'

/** 只带乐观锁版本的动作端点入参（提交、接收、程序完成）。 */
export class VersionLockDto {
  @IsInt() versionLock!: number
}
