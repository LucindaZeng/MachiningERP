import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { DEFAULT_LIST_LIMIT } from '../constants/invoice-filters'
import { CreateInvoiceRequestDto } from '../dto/create-invoice-request.dto'
import { InvoiceActionDto } from '../dto/invoice-action.dto'
import { ListInvoiceRequestsDto } from '../dto/list-invoice-requests.dto'
import { InvoiceReadService } from '../services/invoice-read.service'
import { InvoiceRequestService } from '../services/invoice-request.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { InvoiceRequestView } from '../dto/invoice-request-view.dto'

/** 发票申请：查询与建单（业务规格第 9 章）。开票与交付另见 issuance controller。 */
@ApiTags('invoice-request')
@Controller('invoice-requests')
export class InvoiceRequestController {
  constructor(
    private readonly reads: InvoiceReadService,
    private readonly invoices: InvoiceRequestService,
  ) {}

  @Get()
  @ApiOperation({ summary: '发票申请列表（红字发票同列，金额为负）' })
  async list(@Query() query: ListInvoiceRequestsDto): Promise<InvoiceRequestView[]> {
    return this.reads.list({
      customerId: query.customerId,
      status: query.status,
      invoiceKind: query.invoiceKind,
      limit: DEFAULT_LIST_LIMIT,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: '发票申请详情（含 INV-01~04 节点计时）' })
  async detail(@Param('id') id: string): Promise<InvoiceRequestView> {
    return this.reads.detail(id)
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '建发票申请：金额、税率、发票种类与抬头全部自动带出' })
  async create(
    @Body() dto: CreateInvoiceRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceRequestView> {
    const record = await this.invoices.create(
      {
        customerId: dto.customerId,
        shipmentIds: dto.shipmentIds,
        statementId: dto.statementId ?? null,
        statementTotalMinor: dto.statementTotalMinor ? BigInt(dto.statementTotalMinor) : null,
      },
      user,
    )
    return this.reads.render(record)
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '提交复核' })
  async submit(
    @Param('id') id: string,
    @Body() dto: InvoiceActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceRequestView> {
    return this.reads.render(await this.invoices.submit(id, dto.versionLock, user))
  }
}
