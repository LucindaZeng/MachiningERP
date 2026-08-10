import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { InvoiceShipmentDto } from '../dto/invoice-shipment.dto'
import { ShipShipmentDto } from '../dto/ship-shipment.dto'
import { ShipmentActionDto } from '../dto/shipment-action.dto'
import { ShipmentFlowService } from '../services/shipment-flow.service'
import { ShipmentReadService } from '../services/shipment-read.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { ShipmentView } from '../dto/shipment-view.dto'

/**
 * SHP-02~06 与结案的动作端点。
 *
 * 一律用动作端点而不是 PATCH status（api-conventions.md）：
 * 每一步的执行人与时刻都要落审计，节点耗时也靠这个起止点算。
 */
@ApiTags('shipment')
@Controller('shipments')
@RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
export class ShipmentFlowController {
  constructor(
    private readonly flow: ShipmentFlowService,
    private readonly reads: ShipmentReadService,
  ) {}

  @Post(':id/pick')
  @HttpCode(200)
  @ApiOperation({ summary: 'SHP-02 仓库拣配出库' })
  async pick(
    @Param('id') id: string,
    @Body() dto: ShipmentActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentView> {
    return this.reads.render(await this.flow.startPicking(id, dto.versionLock, user))
  }

  @Post(':id/pack')
  @HttpCode(200)
  @ApiOperation({ summary: 'SHP-03 全检包装完成（T1）' })
  async pack(
    @Param('id') id: string,
    @Body() dto: ShipmentActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentView> {
    return this.reads.render(await this.flow.pack(id, dto.versionLock, user))
  }

  @Post(':id/ship')
  @HttpCode(200)
  @ApiOperation({ summary: 'SHP-04 出运发货（品质放行 + 财务信用双闸门）' })
  async ship(
    @Param('id') id: string,
    @Body() dto: ShipShipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentView> {
    const record = await this.flow.ship(
      id,
      dto.versionLock,
      dto.carrier ?? null,
      dto.trackingNo ?? null,
      user,
    )
    return this.reads.render(record)
  }

  @Post(':id/sign')
  @HttpCode(200)
  @ApiOperation({ summary: 'SHP-05 客户签收' })
  async sign(
    @Param('id') id: string,
    @Body() dto: ShipmentActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentView> {
    return this.reads.render(await this.flow.sign(id, dto.versionLock, user))
  }

  @Post(':id/invoice')
  @HttpCode(200)
  @ApiOperation({ summary: 'SHP-06 开票回填，供对账单勾稽' })
  async invoice(
    @Param('id') id: string,
    @Body() dto: InvoiceShipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentView> {
    return this.reads.render(await this.flow.invoice(id, dto.versionLock, dto.invoiceNo, user))
  }

  @Post(':id/close')
  @HttpCode(200)
  @ApiOperation({ summary: '商业关闭（结案前做尾数数量平衡校验）' })
  async close(
    @Param('id') id: string,
    @Body() dto: ShipmentActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentView> {
    return this.reads.render(await this.flow.close(id, dto.versionLock, user))
  }
}
