import { IsInt, IsString, MaxLength, MinLength } from 'class-validator'

/** 判定客诉不成立。理由必填——没写清的「不成立」在下一次同类客诉里毫无参考价值。 */
export class RejectReturnDto {
  @IsInt() versionLock!: number
  @IsString() @MinLength(1) @MaxLength(500) reason!: string
}
