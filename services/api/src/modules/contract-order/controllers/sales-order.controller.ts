import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { CreateSalesOrderDto } from '../dto/create-sales-order.dto'
import { ListOrdersDto } from '../dto/list-orders.dto'
import { RejectOrderDto } from '../dto/reject-order.dto'
import { ReviewOrderDto } from '../dto/review-order.dto'
import { UpdateSalesOrderDto } from '../dto/update-sales-order.dto'
import { OrderContextService } from '../services/order-context.service'
import { OrderReviewService } from '../services/order-review.service'
import { toSalesOrderDraft } from '../services/sales-order-input.mapper'
import { toSalesOrderView } from '../services/sales-order-view.mapper'
import { SalesOrderService } from '../services/sales-order.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { SalesOrderView } from '../dto/sales-order-view.dto'

/**
 * 业务订单（正常 / 样品 / 模具 / 备料四种类型共用一套端点，差异由订单类型规则表决定）。
 *
 * 状态迁移一律用动作端点而非 PATCH status（api-conventions.md），便于记录审批耗时。
 */
@ApiTags('contract-order')
@Controller('sales-orders')
export class SalesOrderController {
  constructor(
    private readonly orders: SalesOrderService,
    private readonly review: OrderReviewService,
    private readonly context: OrderContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: '订单列表（可按客户、类型、状态过滤）' })
  async list(@Query() query: ListOrdersDto): Promise<SalesOrderView[]> {
    const records = await this.orders.list({ ...query, limit: 200 })
    return records.map(toSalesOrderView)
  }

  @Get(':id')
  @ApiOperation({ summary: '订单详情' })
  async detail(@Param('id') id: string): Promise<SalesOrderView> {
    return toSalesOrderView(await this.orders.load(id))
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '建单（强制校验报价、成本分析与工程资料，缺失项一次列全）' })
  async create(
    @Body() dto: CreateSalesOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalesOrderView> {
    const context = await this.context.build(dto, user)
    return toSalesOrderView(await this.orders.create(toSalesOrderDraft(dto), context, user))
  }

  @Put(':id')
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '整单替换草稿' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSalesOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalesOrderView> {
    const context = await this.context.build(dto, user)
    const record = await this.orders.updateDraft(
      id,
      dto.versionLock,
      toSalesOrderDraft(dto),
      context,
      user,
    )
    return toSalesOrderView(record)
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '送审，T0 从此刻起算' })
  async submit(
    @Param('id') id: string,
    @Body() dto: ReviewOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalesOrderView> {
    const current = await this.orders.load(id)
    const context = await this.context.build(toDto(current), user)
    return toSalesOrderView(await this.review.submit(id, dto.versionLock, context, user))
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: '通过当前审核节点（各节点各认自己的权限点）' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ReviewOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalesOrderView> {
    return toSalesOrderView(await this.review.approve(id, dto.versionLock, user))
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: '驳回并退回草稿（理由必填）' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalesOrderView> {
    return toSalesOrderView(await this.review.reject(id, dto.versionLock, dto.reason, user))
  }
}

/** 已落库的订单反推成校验入参形状，供送审时重跑一次下单校验。 */
function toDto(record: Awaited<ReturnType<SalesOrderService['load']>>): CreateSalesOrderDto {
  return {
    customerId: record.customerId,
    orderType: record.orderType,
    chargeMode: record.chargeMode,
    lines: record.lines.map((line) => ({
      sequence: line.sequence,
      productName: line.productName,
      drawingNo: line.drawingNo,
      bomRequestNo: line.bomRequestNo,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor.toString(),
    })),
  }
}
