import { IsInt, IsString, MaxLength, MinLength } from 'class-validator'

/**
 * 申报之后的更正（EXP-04）。**理由必填**——已申报资料是对海关的正式陈述。
 * 「改了哪几份」由服务端拿两份快照比出来，不让人手填：手填的清单迟早对不上。
 */
export class CorrectDossierDto {
  @IsInt() versionLock!: number
  @IsString() @MinLength(1) @MaxLength(500) reason!: string
}
