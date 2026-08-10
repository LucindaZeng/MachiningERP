import { Module } from '@nestjs/common'

import { AuditModule } from '../../platform/audit'
import { EventsModule } from '../../platform/events'
import { NumberingModule } from '../../platform/numbering'
import { ObjectStorageModule } from '../../platform/object-storage'
import { MasterdataModule } from '../masterdata'

import { CustomerPoUploadController } from './controllers/customer-po-upload.controller'
import { OrderChangeRequestController } from './controllers/order-change-request.controller'
import { OrderTrackingController } from './controllers/order-tracking.controller'
import { SalesOrderController } from './controllers/sales-order.controller'
import { StockPrepController } from './controllers/stock-prep.controller'
import { ORDER_CHANGE_REQUEST_REPOSITORY } from './repositories/order-change-request.repository.port'
import { ORDER_TRACKING_REPOSITORY } from './repositories/order-tracking.repository.port'
import { PrismaOrderChangeRequestRepository } from './repositories/prisma-order-change-request.repository'
import { PrismaOrderTrackingRepository } from './repositories/prisma-order-tracking.repository'
import { PrismaSalesOrderRepository } from './repositories/prisma-sales-order.repository'
import { PrismaStockConsumptionRepository } from './repositories/prisma-stock-consumption.repository'
import { SALES_ORDER_REPOSITORY } from './repositories/sales-order.repository.port'
import { STOCK_CONSUMPTION_REPOSITORY } from './repositories/stock-consumption.repository.port'
import { BomReadinessService } from './services/bom-readiness.service'
import { CustomerPoUploadService } from './services/customer-po-upload.service'
import { OrderChangeRequestService } from './services/order-change-request.service'
import { OrderContextService } from './services/order-context.service'
import { OrderFulfilmentService } from './services/order-fulfilment.service'
import { OrderReviewService } from './services/order-review.service'
import { OrderTrackingService } from './services/order-tracking.service'
import { SalesOrderService } from './services/sales-order.service'
import { StockConsumptionService } from './services/stock-consumption.service'

/**
 * contract-order：订单管理（业务规格第 4 章）。
 *
 * 依赖 masterdata 取「客户档案是否补全」这一条下单闸门，
 * 走的是它的公开出口而不是内部文件。
 */
@Module({
  imports: [NumberingModule, EventsModule, AuditModule, ObjectStorageModule, MasterdataModule],
  controllers: [
    SalesOrderController,
    CustomerPoUploadController,
    StockPrepController,
    OrderChangeRequestController,
    OrderTrackingController,
  ],
  providers: [
    SalesOrderService,
    OrderReviewService,
    StockConsumptionService,
    OrderContextService,
    BomReadinessService,
    CustomerPoUploadService,
    OrderFulfilmentService,
    OrderChangeRequestService,
    OrderTrackingService,
    { provide: SALES_ORDER_REPOSITORY, useClass: PrismaSalesOrderRepository },
    { provide: STOCK_CONSUMPTION_REPOSITORY, useClass: PrismaStockConsumptionRepository },
    { provide: ORDER_CHANGE_REQUEST_REPOSITORY, useClass: PrismaOrderChangeRequestRepository },
    { provide: ORDER_TRACKING_REPOSITORY, useClass: PrismaOrderTrackingRepository },
  ],
  exports: [
    SalesOrderService,
    OrderReviewService,
    StockConsumptionService,
    OrderChangeRequestService,
    OrderTrackingService,
    BomReadinessService,
    CustomerPoUploadService,
    OrderFulfilmentService,
  ],
})
export class ContractOrderModule {}
