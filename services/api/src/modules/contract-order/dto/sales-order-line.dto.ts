import { IsDateString, IsInt, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * 订单明细行。一张订单可下多项产品，每行独立数量、单价与交期跟踪。
 *
 * 金额用**字符串**传（JSON 没有 bigint），数量同样是 decimal 字符串。
 */
export class SalesOrderLineDto {
  @IsInt() sequence!: number

  /** 环环相扣：必须来自生效报价单行 */
  @IsOptional() @IsString() quotationId?: string | null
  @IsOptional() @IsString() quotationItemId?: string | null
  @IsOptional() @IsString() costAnalysisId?: string | null

  @IsString() @MaxLength(128) productName!: string
  @IsString() @MaxLength(128) drawingNo!: string
  @IsOptional() @IsString() drawingVersionId?: string | null
  @IsOptional() @IsString() @MaxLength(32) revision?: string | null
  /** 10 位物料码；样品单无品号 */
  @IsOptional() @IsString() @MaxLength(16) itemCode?: string | null
  @IsOptional() @IsString() @MaxLength(32) bomRequestNo?: string | null

  @IsNumberString() quantity!: string
  @IsNumberString() unitPriceMinor!: string
  /** 客户交期；备料订单为空 */
  @IsOptional() @IsDateString() deliveryDate?: string | null
  @IsOptional() @IsString() @MaxLength(255) remark?: string | null
}
