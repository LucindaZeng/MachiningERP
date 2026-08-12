import { IsIn, IsInt, IsNumberString, IsOptional } from 'class-validator'

import { CUSTOMS_DOC_KIND_VALUES } from '../constants/customs-doc-kinds'

/**
 * 出具一份文件的新版本（EXP-03）。**永远是追加**，不覆盖既有版本。
 * 不传汇率时用资料包上的当日汇率。
 */
export class GenerateDocumentDto {
  @IsInt() versionLock!: number
  @IsIn(CUSTOMS_DOC_KIND_VALUES) kind!: (typeof CUSTOMS_DOC_KIND_VALUES)[number]
  @IsOptional() @IsNumberString() exchangeRate?: string
}
