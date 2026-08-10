import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { ListReturnsDto } from '../dto/list-returns.dto'
import { RegisterReturnDto } from '../dto/register-return.dto'
import { toReturnQuery } from '../services/return-input.mapper'
import { ReturnReadService } from '../services/return-read.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { SalesReturnView } from '../dto/sales-return-view.dto'

const DEFAULT_LIST_LIMIT = 200

/**
 * 退货单：查询与登记（RMA-01）。
 * 节点推进另见 return-flow.controller.ts——动作端点多，拆开才守得住每个 controller ≤ 8 路由。
 */
@ApiTags('sales-return')
@Controller('sales-returns')
export class SalesReturnController {
  constructor(private readonly reads: ReturnReadService) {}

  @Get()
  @ApiOperation({ summary: '退货单列表（可按客户、订单、出货单、状态、结案日期过滤）' })
  async list(@Query() query: ListReturnsDto): Promise<SalesReturnView[]> {
    return this.reads.list({ ...toReturnQuery(query), limit: DEFAULT_LIST_LIMIT })
  }

  @Get(':id')
  @ApiOperation({ summary: '退货单详情（含逐行责任归属 / 处置与 RMA-01~05 节点计时）' })
  async detail(@Param('id') id: string): Promise<SalesReturnView> {
    return this.reads.detail(id)
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '登记客诉 / 退货（RMA-01），一单可含多项产品' })
  async register(
    @Body() dto: RegisterReturnDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalesReturnView> {
    return this.reads.registerAndView(dto, user)
  }
}
