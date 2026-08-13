import { IsOptional, IsString, MaxLength, Matches } from 'class-validator'

/**
 * 一条受影响数量。
 *
 * 数量用**定点数字符串**而不是 number：数量口径全库一致，禁止浮点。
 * 计数定义见 constants/ecn-production-impact.ts 的 `AFFECTED_QTY_RULE`——
 * 只要生产（车床/CNC）动了就计入，尚未上机的料不计。
 */
export class AffectedLineDto {
  @IsString() @MaxLength(128) productName!: string
  @IsString() @MaxLength(64) drawingNo!: string
  @Matches(/^\d+(\.\d{1,6})?$/, { message: '受影响数量必须是非负定点数' })
  affectedQty!: string
  @IsOptional() @IsString() @MaxLength(500) note?: string | null
}
