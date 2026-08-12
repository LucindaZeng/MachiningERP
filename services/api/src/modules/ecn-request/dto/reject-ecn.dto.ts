import { IsInt, IsString, MaxLength, Min } from 'class-validator'

/** 驳回：理由必填，且会原样带进给业务员的通知里。 */
export class RejectEcnDto {
  @IsInt() @Min(0) versionLock!: number
  @IsString() @MaxLength(500) reason!: string
}
