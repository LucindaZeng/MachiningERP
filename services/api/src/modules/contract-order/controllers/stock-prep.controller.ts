import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { ConsumeStockDto } from '../dto/consume-stock.dto'
import { StockConsumptionService } from '../services/stock-consumption.service'
import { toAvailabilityView, toConsumptionView } from '../services/stock-prep-view.mapper'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { StockConsumptionView } from '../dto/stock-consumption-view.dto'
import type { StockPrepAvailabilityView } from '../dto/stock-prep-view.dto'

/**
 * 备料库存领用（业务规格 4.5）。
 *
 * 领用数量由后端按「优先消耗备料直到用完」算出来，前端不传领用量——
 * 让调用方指定领多少，就等于把「先用完备料」这条规则交给了前端。
 */
@ApiTags('contract-order')
@Controller('stock-prep')
export class StockPrepController {
  constructor(private readonly stock: StockConsumptionService) {}

  @Get('available')
  @ApiOperation({ summary: '按图号查可领用的备料订单（必须已完工入库）' })
  async available(@Query('drawingNo') drawingNo: string): Promise<StockPrepAvailabilityView[]> {
    const records = await this.stock.listAvailable(drawingNo)
    return records.map(toAvailabilityView)
  }

  @Get(':id/consumptions')
  @ApiOperation({ summary: '备料领用履历：被哪些正式订单行消耗过' })
  async history(@Param('id') id: string): Promise<StockConsumptionView[]> {
    const records = await this.stock.history(id)
    return records.map(toConsumptionView)
  }

  @Post('consume')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '正式订单领用备料，返回加权平均单件成本' })
  async consume(
    @Body() dto: ConsumeStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StockConsumptionView> {
    const record = await this.stock.consume(
      {
        orderLineId: dto.orderLineId,
        stockOrderId: dto.stockOrderId,
        orderQty: dto.orderQty,
        produceUnitCostMinor: BigInt(dto.produceUnitCostMinor),
      },
      user,
    )
    return toConsumptionView(record)
  }

  @Delete('consumptions/:orderLineId')
  @HttpCode(204)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '解除该订单行的备料领用' })
  async release(
    @Param('orderLineId') orderLineId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.stock.release(orderLineId, user)
  }
}
