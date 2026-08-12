import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { DEFAULT_LIST_LIMIT } from '../constants/customs-filters'
import { CreateDossierDto } from '../dto/create-dossier.dto'
import { GenerateDocumentDto } from '../dto/generate-document.dto'
import { ListDossiersDto } from '../dto/list-dossiers.dto'
import { CustomsDocumentFacade } from '../services/customs-document.facade'
import { CustomsReadService } from '../services/customs-read.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { CustomsDossierView } from '../dto/customs-dossier-view.dto'

/**
 * 报关资料：查询、建档（EXP-01）与文件出具（EXP-03）。
 * 复核与申报另见 customs-flow.controller.ts——拆开才守得住每个 controller ≤ 8 路由。
 */
@ApiTags('customs')
@Controller('customs-dossiers')
export class CustomsController {
  constructor(
    private readonly reads: CustomsReadService,
    private readonly documents: CustomsDocumentFacade,
  ) {}

  @Get()
  @ApiOperation({ summary: '报关资料列表（可按客户、出货单、订单、状态过滤）' })
  async list(@Query() query: ListDossiersDto): Promise<CustomsDossierView[]> {
    return this.reads.list({
      customerId: query.customerId,
      shipmentId: query.shipmentId,
      orderId: query.orderId,
      status: query.status,
      ownerUserCode: query.ownerUserCode,
      limit: DEFAULT_LIST_LIMIT,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: '报关资料详情（含文件版本、申报快照与更正记录）' })
  async detail(@Param('id') id: string): Promise<CustomsDossierView> {
    return this.reads.detail(id)
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '建档报关资料（EXP-01），商品与贸易要素从出货单带出' })
  async create(
    @Body() dto: CreateDossierDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomsDossierView> {
    return this.documents.createAndView(dto, user)
  }

  @Post(':id/documents')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: 'EXP-03 出具一份文件的新版本；要素不齐或未过账时拒绝' })
  async generate(
    @Param('id') id: string,
    @Body() dto: GenerateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomsDossierView> {
    return this.documents.generateAndView(id, dto, user)
  }
}
