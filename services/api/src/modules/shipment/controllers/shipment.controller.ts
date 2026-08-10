import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { DEFAULT_LIST_LIMIT } from '../constants/shipment-filters'
import { CreateShipmentDto } from '../dto/create-shipment.dto'
import { ListShipmentsDto } from '../dto/list-shipments.dto'
import { TailPlanDto } from '../dto/tail-plan.dto'
import { ShipmentReadService } from '../services/shipment-read.service'
import { ShipmentTailService } from '../services/shipment-tail.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { ShipmentView } from '../dto/shipment-view.dto'
import type { TailPlanResultView } from '../dto/tail-plan-result.dto'

/**
 * 出货单：查询、建单（SHP-01）与尾数处理。
 * 节点推进另见 shipment-flow.controller.ts——动作端点多，拆开才守得住每个 controller ≤ 8 路由。
 */
@ApiTags('shipment')
@Controller('shipments')
export class ShipmentController {
  constructor(
    private readonly reads: ShipmentReadService,
    private readonly tail: ShipmentTailService,
  ) {}

  @Get()
  @ApiOperation({ summary: '出货单列表（可按客户、订单、状态、发货日期过滤）' })
  async list(@Query() query: ListShipmentsDto): Promise<ShipmentView[]> {
    return this.reads.list({
      customerId: query.customerId,
      orderId: query.orderId,
      status: query.status,
      ownerUserCode: query.ownerUserCode,
      shippedFrom: query.shippedFrom ? new Date(query.shippedFrom) : undefined,
      shippedTo: query.shippedTo ? new Date(query.shippedTo) : undefined,
      limit: DEFAULT_LIST_LIMIT,
    })
  }

  /** 尾数处理必须排在 :id 之前，否则 tail-plan 会被当成一个 id。 */
  @Post('tail-plan')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '尾数四路径处理：返工补交 / 入库 / 直接入库 / 报废' })
  async tailPlan(
    @Body() dto: TailPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TailPlanResultView> {
    return this.tail.applyByDocNo(dto.docNo, dto.plan, dto.remark ?? null, user)
  }

  @Get(':id')
  @ApiOperation({ summary: '出货单详情（含明细与 SHP-01~06 节点计时）' })
  async detail(@Param('id') id: string): Promise<ShipmentView> {
    return this.reads.detail(id)
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '生成发货通知（SHP-01），一单可含多项产品' })
  async create(
    @Body() dto: CreateShipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentView> {
    return this.reads.createAndView(dto, user)
  }
}
