import { IsIn, IsOptional, IsString } from 'class-validator'

import { INVOICE_KIND_VALUES, INVOICE_STATUS_VALUES } from '../constants/invoice-filters'

import type { InvoiceKindFilter, InvoiceStatusFilter } from '../constants/invoice-filters'

/** 列表查询条件；枚举住在 constants/，DTO 不必 import @prisma/client。 */
export class ListInvoiceRequestsDto {
  @IsOptional() @IsString() customerId?: string
  @IsOptional() @IsIn(INVOICE_STATUS_VALUES) status?: InvoiceStatusFilter
  @IsOptional() @IsIn(INVOICE_KIND_VALUES) invoiceKind?: InvoiceKindFilter
}
