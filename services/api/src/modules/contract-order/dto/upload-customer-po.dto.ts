import { IsOptional, IsString } from 'class-validator'

/**
 * 客户订单原件上传的表单字段（文件本体走 multipart 的 file 部分）。
 * `orderId` 可空：新建表单里订单尚未落库，先传文件拿键，建单时再带上。
 */
export class UploadCustomerPoDto {
  @IsOptional() @IsString() orderId?: string
}
