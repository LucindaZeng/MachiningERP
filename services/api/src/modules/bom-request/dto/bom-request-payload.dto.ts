import { IsDateString, IsIn, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator'

import type { BomProductionType } from '@prisma/client'

const PRODUCTION_TYPES = ['BATCH', 'MOLD'] as const

/**
 * BOM 申请内容。
 *
 * `quotationItemId` 与 `drawingVersionId` 都是必填：申请必须引用报价单里的产品，
 * 图纸沿用报价环节上传的版本，**不在这里重复上传**（业务规格第 5 章）。
 * 样品不建 BOM，所以 productionType 里没有 sample。
 */
export class BomRequestPayloadDto {
  @IsString() customerId!: string
  @IsString() quotationId!: string
  @IsString() quotationItemId!: string
  @IsString() drawingVersionId!: string
  @IsOptional() @IsString() @MaxLength(64) customerPoNo?: string | null

  @IsString() @MaxLength(128) productName!: string
  @IsString() @MaxLength(128) drawingNo!: string
  @IsString() @MaxLength(32) drawingVersion!: string
  @IsString() @MaxLength(64) material!: string
  @IsString() @MaxLength(64) surfaceTreatment!: string
  @IsString() @MaxLength(128) inspection!: string
  @IsString() @MaxLength(128) packing!: string

  @IsNumberString() quantity!: string
  @IsOptional() @IsDateString() targetDeliveryDate?: string | null

  @IsIn(PRODUCTION_TYPES) productionType!: BomProductionType
  /** 样品转量产时回填，用于把试做工时带入首次量产 */
  @IsOptional() @IsString() @MaxLength(32) fromSampleNo?: string | null
  @IsOptional() @IsString() @MaxLength(500) specialRequirement?: string | null
}
