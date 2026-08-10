import { IsBooleanString, IsIn, IsOptional, IsString } from 'class-validator'

import { STATEMENT_STATUS_VALUES } from '../constants/shipment-filters'

import type { StatementStatusFilter } from '../constants/shipment-filters'

/** 对账单列表查询条件。latestOnly 只看每个客户+期间的最新版本。 */
export class ListStatementsDto {
  @IsOptional() @IsString() customerId?: string
  @IsOptional() @IsIn(STATEMENT_STATUS_VALUES) status?: StatementStatusFilter
  @IsOptional() @IsBooleanString() latestOnly?: string
}
