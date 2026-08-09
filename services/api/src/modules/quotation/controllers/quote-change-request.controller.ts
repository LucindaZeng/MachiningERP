import { PERMISSION_CODES, type CurrencyCode } from '@machining-erp/shared'
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { CreateQuoteChangeDto } from '../dto/create-quote-change.dto'
import { RejectQuoteChangeDto } from '../dto/reject-quote-change.dto'
import { ReviseQuoteChangeDto } from '../dto/revise-quote-change.dto'
import { toCostAnalysisLineDrafts, toCostRates } from '../services/cost-analysis-input.mapper'
import { toTargetPrices } from '../services/quotation-input.mapper'
import { QuoteChangeRequestService } from '../services/quote-change-request.service'
import { toQuoteChangeView } from '../services/quote-change-view.mapper'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { QuoteChangeRequestView } from '../dto/quote-change-view.dto'

/** 报价单修改申请：业务提目标价 → 报价工程师重核出新版本，或驳回并说明理由。 */
@ApiTags('quotation')
@Controller('quote-change-requests')
export class QuoteChangeRequestController {
  constructor(private readonly requests: QuoteChangeRequestService) {}

  @Get()
  @ApiOperation({ summary: '按报价单列修改申请' })
  async list(
    @Query('quotationId') quotationId: string,
    @Query('currency') currency?: string,
  ): Promise<QuoteChangeRequestView[]> {
    const records = await this.requests.listByQuotation(quotationId)
    return records.map((record) => toQuoteChangeView(record, asCurrency(currency)))
  }

  @Get(':id')
  @ApiOperation({ summary: '修改申请详情' })
  async detail(
    @Param('id') id: string,
    @Query('currency') currency?: string,
  ): Promise<QuoteChangeRequestView> {
    return toQuoteChangeView(await this.requests.load(id), asCurrency(currency))
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '提交报价单修改申请' })
  async submit(
    @Body() dto: CreateQuoteChangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuoteChangeRequestView> {
    const record = await this.requests.submit(
      {
        quotationId: dto.quotationId,
        engineerUserCode: dto.engineerUserCode,
        reason: dto.reason,
        targetPrices: toTargetPrices(dto.targetPrices),
      },
      user,
    )
    return toQuoteChangeView(record, 'CNY')
  }

  @Post(':id/revise')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_CHANGE_HANDLE)
  @ApiOperation({ summary: '重核并生成新的成本分析版本' })
  async revise(
    @Param('id') id: string,
    @Body() dto: ReviseQuoteChangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuoteChangeRequestView> {
    const lines = dto.lines ? toCostAnalysisLineDrafts(dto.lines) : null
    const record = await this.requests.revise(id, dto.versionLock, lines, user, toCostRates(dto))
    return toQuoteChangeView(record, 'CNY')
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_CHANGE_HANDLE)
  @ApiOperation({ summary: '驳回修改申请（理由必填，回到业务员工作台）' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectQuoteChangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuoteChangeRequestView> {
    const record = await this.requests.reject(id, dto.versionLock, dto.reason, user)
    return toQuoteChangeView(record, 'CNY')
  }
}

const CURRENCIES: readonly string[] = ['CNY', 'USD', 'HKD', 'EUR', 'JPY']

/** 目标价的币种跟随报价单，查询参数只是展示用途，非法值一律回落到 CNY。 */
function asCurrency(value: string | undefined): CurrencyCode {
  return CURRENCIES.includes(value ?? '') ? (value as CurrencyCode) : 'CNY'
}
