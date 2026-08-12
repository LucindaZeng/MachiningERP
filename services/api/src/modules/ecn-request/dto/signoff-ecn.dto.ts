import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

/** 跨部门会签。各部门模块上线前由工程代签，意见可留空取默认代签说明。 */
export class SignoffEcnDto {
  @IsInt() @Min(0) versionLock!: number
  @IsOptional() @IsString() @MaxLength(500) opinion?: string | null
}
