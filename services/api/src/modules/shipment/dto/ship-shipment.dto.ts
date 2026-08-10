import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * 出运发货（SHP-04）。承运商与运单号在这一步补齐；
 * 品质放行与财务信用两道闸门由服务层检查，前端传不了「跳过」。
 */
export class ShipShipmentDto {
  @IsInt() versionLock!: number
  @IsOptional() @IsString() @MaxLength(128) carrier?: string | null
  @IsOptional() @IsString() @MaxLength(64) trackingNo?: string | null
}
