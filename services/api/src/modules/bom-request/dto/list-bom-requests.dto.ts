import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator'

import { BOM_STATUS_VALUES, PRODUCTION_TYPE_VALUES } from '../constants/bom-request-filters'

import type { BomProductionTypeFilter, BomStatusFilter } from '../constants/bom-request-filters'

export class ListBomRequestsDto {
  @IsOptional() @IsString() customerId?: string
  @IsOptional() @IsString() quotationId?: string
  @IsOptional() @IsDateString() submittedFrom?: string
  @IsOptional() @IsDateString() submittedTo?: string
  @IsOptional() @IsIn(BOM_STATUS_VALUES) status?: BomStatusFilter
  @IsOptional() @IsIn(PRODUCTION_TYPE_VALUES) productionType?: BomProductionTypeFilter
  @IsOptional() @IsString() ownerUserCode?: string
}
