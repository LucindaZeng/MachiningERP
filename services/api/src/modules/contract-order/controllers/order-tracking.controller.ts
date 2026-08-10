import { PERMISSION_CODES } from '@machining-erp/shared'
import { Controller, Get, Param } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { toLineTrackingView } from '../services/order-tracking-view.mapper'
import { OrderTrackingService } from '../services/order-tracking.service'
import { SalesOrderService } from '../services/sales-order.service'

import type { OrderLineTrackingView } from '../dto/order-tracking-view.dto'

/**
 * 订单追踪（业务规格 4.7）。业务部、总经办、PMC 三方均可查看。
 *
 * **只有读端点**：进度来自 MES 扫码、检验记录与仓库过账，
 * 不允许手工填报——所以这里根本不提供写入路由，而不是提供了再去挡。
 */
@ApiTags('contract-order')
@Controller('order-trackings')
export class OrderTrackingController {
  constructor(
    private readonly tracking: OrderTrackingService,
    private readonly orders: SalesOrderService,
  ) {}

  @Get(':orderId')
  @RequirePermissions(PERMISSION_CODES.ORDER_TRACKING_VIEW)
  @ApiOperation({ summary: '订单追踪：按产品行分别给出「完成数/工单数」' })
  async detail(@Param('orderId') orderId: string): Promise<OrderLineTrackingView[]> {
    const order = await this.orders.load(orderId)
    const qtyByLine = new Map(order.lines.map((line) => [line.id, line.quantity]))
    const progress = await this.tracking.orderProgress(orderId, qtyByLine)

    return order.lines
      .map((line) => {
        const lineProgress = progress.get(line.id)
        return lineProgress ? toLineTrackingView(line, lineProgress) : null
      })
      .filter((view): view is OrderLineTrackingView => view !== null)
  }
}
