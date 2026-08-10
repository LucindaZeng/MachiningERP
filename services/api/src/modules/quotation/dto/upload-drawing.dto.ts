import { IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * 图纸上传的表单字段（文件本体走 multipart 的 file 部分）。
 * 版本名可不填，不填时按序号自动生成 REV A / REV B。
 */
export class UploadDrawingDto {
  @IsString() @MaxLength(128) drawingNo!: string
  @IsOptional() @IsString() customerId?: string
  @IsOptional() @IsString() @MaxLength(128) title?: string
  @IsOptional() @IsString() @MaxLength(32) revision?: string
}
