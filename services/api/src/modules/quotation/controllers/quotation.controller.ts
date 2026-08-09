import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { ApproveQuotationDto } from '../dto/approve-quotation.dto'
import { CreateQuotationDto } from '../dto/create-quotation.dto'
import { RejectQuotationDto } from '../dto/reject-quotation.dto'
import { SubmitQuotationDto } from '../dto/submit-quotation.dto'
import { UpdateQuotationDto } from '../dto/update-quotation.dto'
import { toQuotationDraftPayload } from '../services/quotation-input.mapper'
import { QuotationReviewService } from '../services/quotation-review.service'
import { toQuotationView } from '../services/quotation-view.mapper'
import { QuotationService } from '../services/quotation.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { QuotationView } from '../dto/quotation-view.dto'

/**
 * 报价单。成本与毛利是否下发由 `toQuotationView` 按权限决定——
 * controller 只做编解码，不做可见性判断。
 */
@ApiTags('quotation')
@Controller('quotations')
export class QuotationController {
  constructor(
    private readonly quotations: QuotationService,
    private readonly review: QuotationReviewService,
  ) {}

  @Get()
  @ApiOperation({ summary: '按客户列报价单' })
  async list(
    @Query('customerId') customerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuotationView[]> {
    const records = await this.quotations.listByCustomer(customerId)
    return records.map((record) => toQuotationView(record, user.permissions))
  }

  @Get(':id')
  @ApiOperation({ summary: '报价单详情' })
  async detail(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuotationView> {
    return toQuotationView(await this.quotations.load(id), user.permissions)
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '建立报价单（强制关联成本分析、强制图纸）' })
  async create(
    @Body() dto: CreateQuotationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuotationView> {
    const record = await this.quotations.create(toQuotationDraftPayload(dto), user)
    return toQuotationView(record, user.permissions)
  }

  @Put(':id')
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '整单替换草稿' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuotationView> {
    const record = await this.quotations.updateDraft(
      id,
      dto.versionLock,
      toQuotationDraftPayload(dto),
      user,
    )
    return toQuotationView(record, user.permissions)
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '送审（低于成本价会被拦下）' })
  async submit(
    @Param('id') id: string,
    @Body() dto: SubmitQuotationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuotationView> {
    const record = await this.review.submit(id, dto.versionLock, dto.approverUserCode, user)
    return toQuotationView(record, user.permissions)
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_APPROVE)
  @ApiOperation({ summary: '审核通过，报价生效并锁定成本分析版本' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveQuotationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuotationView> {
    const validUntil = dto.validUntil ? new Date(dto.validUntil) : null
    const record = await this.review.approve(id, dto.versionLock, validUntil, user)
    return toQuotationView(record, user.permissions)
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_APPROVE)
  @ApiOperation({ summary: '驳回并退回草稿（理由必填）' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectQuotationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuotationView> {
    const record = await this.review.reject(id, dto.versionLock, dto.reason, user)
    return toQuotationView(record, user.permissions)
  }
}
