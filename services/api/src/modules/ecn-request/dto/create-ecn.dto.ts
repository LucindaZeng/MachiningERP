import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

/**
 * 提交工程变更申请（ECN-01）。
 *
 * `changeType` 用 `IsString` 而不是 `IsIn`：越界类型要由服务端的受理范围闸门
 * **点名正确去处**（「改数量请走订单修改申请」），而 class-validator 只会说
 * 「必须是以下值之一」——那句话帮不了任何人。
 */
export class CreateEcnDto {
  @IsUUID() customerId!: string
  @IsOptional() @IsUUID() orderId?: string | null

  @IsString() @MaxLength(128) productName!: string
  @IsString() @MaxLength(64) drawingNo!: string

  @IsOptional() @IsUUID() drawingVersionId?: string | null
  /** 改图必填；由 quotation 的图纸上传通道产生 */
  @IsOptional() @IsUUID() newDrawingVersionId?: string | null
  @IsOptional() @IsUUID() bomRequestId?: string | null
  @IsOptional() @IsUUID() quotationId?: string | null

  @IsString() changeType!: string
  @IsIn(['CUSTOMER', 'INTERNAL']) origin!: 'CUSTOMER' | 'INTERNAL'
  @IsBoolean() urgent!: boolean

  @IsString() @MaxLength(1000) beforeValue!: string
  @IsString() @MaxLength(1000) afterValue!: string
  @IsString() @MaxLength(1000) reason!: string
}
