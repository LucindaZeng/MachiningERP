import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator'

/** 多选合并导出。份数上限在服务层判（`MERGE_EXPORT_LIMIT`），那里才报得出具体数字。 */
export class MergeExportDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ids!: string[]
}
