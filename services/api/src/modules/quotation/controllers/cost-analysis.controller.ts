import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { CompleteCostAnalysisDto } from '../dto/complete-cost-analysis.dto'
import { CreateCostAnalysisDto } from '../dto/create-cost-analysis.dto'
import { ReplaceCostLinesDto } from '../dto/replace-cost-lines.dto'
import { UpdateCostRatesDto } from '../dto/update-cost-rates.dto'
import { toCostAnalysisLineDrafts } from '../services/cost-analysis-input.mapper'
import { toCostAnalysisView } from '../services/cost-analysis-view.mapper'
import { CostingService } from '../services/costing.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { CostAnalysisView } from '../dto/cost-analysis-view.dto'

/**
 * 成本分析（核价）。整个 controller 都挂 `quote.costing.edit`——
 * 业务规格 2.2：成本分析只有报价工程师可做。service 层另有一道同样的闸门。
 */
@ApiTags('quotation')
@Controller('cost-analyses')
export class CostAnalysisController {
  constructor(private readonly costing: CostingService) {}

  @Get(':id')
  @ApiOperation({ summary: '成本分析详情（含各行与汇总）' })
  async detail(@Param('id') id: string): Promise<CostAnalysisView> {
    const record = await this.costing.load(id)
    return toCostAnalysisView(record, this.costing.totalsOf(record))
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.COSTING_EDIT)
  @ApiOperation({ summary: '建立成本分析（仅报价工程师）' })
  async create(
    @Body() dto: CreateCostAnalysisDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CostAnalysisView> {
    const record = await this.costing.create(
      { ...dto, lines: toCostAnalysisLineDrafts(dto.lines) },
      user,
    )
    return toCostAnalysisView(record, this.costing.totalsOf(record))
  }

  @Put(':id/lines')
  @RequirePermissions(PERMISSION_CODES.COSTING_EDIT)
  @ApiOperation({ summary: '整表替换成本分析明细（仅报价工程师）' })
  async replaceLines(
    @Param('id') id: string,
    @Body() dto: ReplaceCostLinesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CostAnalysisView> {
    const record = await this.costing.replaceLines(
      id,
      dto.versionLock,
      toCostAnalysisLineDrafts(dto.lines),
      user,
    )
    return toCostAnalysisView(record, this.costing.totalsOf(record))
  }

  @Put(':id/rates')
  @RequirePermissions(PERMISSION_CODES.COSTING_EDIT)
  @ApiOperation({ summary: '调整损耗率/管理费率/税率（仅报价工程师；默认 5%/5%/13% 可改）' })
  async updateRates(
    @Param('id') id: string,
    @Body() dto: UpdateCostRatesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CostAnalysisView> {
    const record = await this.costing.updateRates(
      id,
      dto.versionLock,
      { lossBps: dto.lossBps, overheadBps: dto.overheadBps, vatBps: dto.vatBps },
      user,
    )
    return toCostAnalysisView(record, this.costing.totalsOf(record))
  }

  @Post(':id/complete')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.COSTING_EDIT)
  @ApiOperation({ summary: '核价完成，通知业务员生成报价单' })
  async complete(
    @Param('id') id: string,
    @Body() dto: CompleteCostAnalysisDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CostAnalysisView> {
    const record = await this.costing.complete(id, dto.salesUserCode, user)
    return toCostAnalysisView(record, this.costing.totalsOf(record))
  }
}
