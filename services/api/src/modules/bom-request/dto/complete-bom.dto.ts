import { IsInt, IsString, MaxLength, MinLength } from 'class-validator'

/** BOM 建立完成：量产回填品号，模具回填模具编号。 */
export class CompleteBomDto {
  @IsInt() versionLock!: number
  @IsString() @MinLength(1) @MaxLength(16) productCode!: string
}
