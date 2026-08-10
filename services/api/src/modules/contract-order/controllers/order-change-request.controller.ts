import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { CreateOrderChangeDto } from '../dto/create-order-change.dto'
import { HandleOrderChangeDto } from '../dto/handle-order-change.dto'
import { RejectOrderChangeDto } from '../dto/reject-order-change.dto'
import { OrderChangeRequestService } from '../services/order-change-request.service'
import { toOrderChangeView } from '../services/order-change-view.mapper'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { OrderChangeRequestView } from '../dto/order-change-view.dto'

/**
 * 订单修改申请（业务规格 4.6）：只改数量、交期等订单信息。
 * 改价走报价单修改申请，改图/改材料/改表处走 ECN。
 */
@ApiTags('contract-order')
@Controller('order-changes')
export class OrderChangeRequestController {
  constructor(private readonly requests: OrderChangeRequestService) {}

  @Get()
  @ApiOperation({ summary: '按订单列修改申请' })
  async list(@Query('orderId') orderId: string): Promise<OrderChangeRequestView[]> {
    const records = await this.requests.listByOrder(orderId)
    return records.map(toOrderChangeView)
  }

  @Get(':id')
  @ApiOperation({ summary: '修改申请详情' })
  async detail(@Param('id') id: string): Promise<OrderChangeRequestView> {
    return toOrderChangeView(await this.requests.load(id))
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '提交订单修改申请（价格与下单产品锁定）' })
  async submit(
    @Body() dto: CreateOrderChangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderChangeRequestView> {
    const record = await this.requests.submit(
      {
        orderId: dto.orderId,
        orderLineId: dto.orderLineId ?? null,
        changeType: dto.changeType,
        origin: dto.origin,
        urgent: dto.urgent ?? false,
        beforeValue: dto.beforeValue,
        afterValue: dto.afterValue,
        reason: dto.reason,
        costOwner: dto.costOwner ?? null,
      },
      user,
    )
    return toOrderChangeView(record)
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.ORDER_APPROVE)
  @ApiOperation({ summary: '批准修改申请' })
  async approve(
    @Param('id') id: string,
    @Body() dto: HandleOrderChangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderChangeRequestView> {
    return toOrderChangeView(await this.requests.approve(id, dto.versionLock, user))
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.ORDER_APPROVE)
  @ApiOperation({ summary: '驳回修改申请（理由必填）' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectOrderChangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderChangeRequestView> {
    return toOrderChangeView(await this.requests.reject(id, dto.versionLock, dto.reason, user))
  }
}
