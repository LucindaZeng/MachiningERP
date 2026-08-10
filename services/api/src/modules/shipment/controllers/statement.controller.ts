import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { DEFAULT_LIST_LIMIT } from '../constants/shipment-filters'
import { DisputeStatementDto } from '../dto/dispute-statement.dto'
import { GenerateStatementDto } from '../dto/generate-statement.dto'
import { ListStatementsDto } from '../dto/list-statements.dto'
import { MatchStatementLineDto } from '../dto/match-statement-line.dto'
import { StatementActionDto } from '../dto/statement-action.dto'
import { StatementReadService } from '../services/statement-read.service'
import { StatementService } from '../services/statement.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { StatementView } from '../dto/statement-view.dto'

/**
 * 客户对账单（STM）。
 *
 * 没有「改金额」的端点，这是刻意的：金额一律由源单汇总，
 * 对不上就回源单改，改完重新生成一版。
 */
@ApiTags('shipment')
@Controller('statements')
export class StatementController {
  constructor(
    private readonly statements: StatementService,
    private readonly reads: StatementReadService,
  ) {}

  /** `customer` 必须排在 `:id` 前面，否则会被当成一个 id。 */
  @Get('customer')
  @ApiOperation({ summary: '客户对账单列表' })
  async list(@Query() query: ListStatementsDto): Promise<StatementView[]> {
    return this.reads.list({
      customerId: query.customerId,
      status: query.status,
      latestOnly: query.latestOnly === 'true',
      limit: DEFAULT_LIST_LIMIT,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: '对账单详情' })
  async detail(@Param('id') id: string): Promise<StatementView> {
    return this.reads.detail(id)
  }

  @Post('generate')
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '按客户与期间从源单生成（重算产出新版本，不改旧版）' })
  async generate(
    @Body() dto: GenerateStatementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StatementView> {
    const record = await this.statements.generate(
      {
        customerId: dto.customerId,
        periodFrom: new Date(dto.periodFrom),
        periodTo: new Date(dto.periodTo),
        basis: dto.basis ?? 'SHIPMENT',
        customerClosingMinor: dto.customerClosingMinor ? BigInt(dto.customerClosingMinor) : null,
      },
      user,
    )
    return this.reads.render(record)
  }

  @Post(':id/send')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '发出给客户签回（差异非零且无说明时拒绝）' })
  async send(
    @Param('id') id: string,
    @Body() dto: StatementActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StatementView> {
    return this.reads.render(await this.statements.send(id, dto.versionLock, user))
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '客户回签确认' })
  async confirm(
    @Param('id') id: string,
    @Body() dto: StatementActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StatementView> {
    return this.reads.render(await this.statements.confirm(id, dto.versionLock, user))
  }

  @Post(':id/dispute')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '客户提出差异（说明必填，差异回源单处理）' })
  async dispute(
    @Param('id') id: string,
    @Body() dto: DisputeStatementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StatementView> {
    const record = await this.statements.dispute(id, dto.versionLock, dto.differenceNote, user)
    return this.reads.render(record)
  }

  @Post(':id/settle')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '结清（款项收齐，本期对账关闭）' })
  async settle(
    @Param('id') id: string,
    @Body() dto: StatementActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StatementView> {
    return this.reads.render(await this.statements.settle(id, dto.versionLock, user))
  }

  @Put(':id/lines/:lineId/matched')
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '标记某行客户是否已核对（对账单上唯一可人工改的字段）' })
  async setMatched(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: MatchStatementLineDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StatementView> {
    const record = await this.statements.setLineMatched(id, lineId, dto.matched, user)
    return this.reads.render(record)
  }
}
