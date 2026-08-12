import { Module } from '@nestjs/common'

import { NotificationModule } from '../../platform/notification'
import { TimelineModule } from '../../platform/timeline'
import { ContractOrderModule } from '../contract-order'
import { InvoiceRequestModule } from '../invoice-request'
import { SalesReturnModule } from '../sales-return'
import { ShipmentModule } from '../shipment'

import { SalesAnalyticsController } from './controllers/sales-analytics.controller'
import { SalesWorkbenchController } from './controllers/sales-workbench.controller'
import {
  StubCostingAnalyticsAdapter,
  StubFinanceAnalyticsAdapter,
  StubMesAnalyticsAdapter,
  StubWmsAnalyticsAdapter,
} from './repositories/stub-upstream.adapters'
import {
  COSTING_ANALYTICS_PORT,
  FINANCE_ANALYTICS_PORT,
  MES_ANALYTICS_PORT,
  WMS_ANALYTICS_PORT,
} from './repositories/upstream-source.ports'
import { AnalyticsOverviewService } from './services/analytics-overview.service'
import { AnalyticsReportService } from './services/analytics-report.service'
import { CustomerAnalyticsService } from './services/customer-analytics.service'
import { DailyOpsService } from './services/daily-ops.service'
import { DeliveryAnalyticsService } from './services/delivery-analytics.service'
import { OrderAnalyticsService } from './services/order-analytics.service'
import { QuoteAnalyticsService } from './services/quote-analytics.service'
import { RmaAnalyticsService } from './services/rma-analytics.service'
import { SlaAnalyticsService } from './services/sla-analytics.service'
import { WorkbenchService } from './services/workbench.service'

/**
 * sales-analytics：业务部经营分析（规格第 11 章）。
 *
 * **只读模块**：没有自己的表、没有写端点、没有状态机，
 * 因此也没有 doc_no / 乐观锁 / 迁移审计——那几条 DoD 是给单据表的。
 * 全部数据来自其它模块 index.ts 上的公开服务。
 *
 * ⚠️ 四个 STUB provider（costing / finance / wms / mes）是那四个模块落地前的
 * 临时实现，**一律返回空行集**，对应面板由 `markPending` 标成「数据源未上线」。
 * 绝不零填：一个填成 0 的报废率读起来是优异表现，而不是「这块没接上」。
 * 上线时只换 provider，聚合逻辑一行不动。
 */
@Module({
  imports: [
    ContractOrderModule,
    ShipmentModule,
    SalesReturnModule,
    InvoiceRequestModule,
    TimelineModule,
    NotificationModule,
  ],
  controllers: [SalesAnalyticsController, SalesWorkbenchController],
  providers: [
    AnalyticsOverviewService,
    AnalyticsReportService,
    DailyOpsService,
    QuoteAnalyticsService,
    OrderAnalyticsService,
    DeliveryAnalyticsService,
    CustomerAnalyticsService,
    RmaAnalyticsService,
    SlaAnalyticsService,
    WorkbenchService,
    { provide: COSTING_ANALYTICS_PORT, useClass: StubCostingAnalyticsAdapter },
    { provide: FINANCE_ANALYTICS_PORT, useClass: StubFinanceAnalyticsAdapter },
    { provide: WMS_ANALYTICS_PORT, useClass: StubWmsAnalyticsAdapter },
    { provide: MES_ANALYTICS_PORT, useClass: StubMesAnalyticsAdapter },
  ],
  exports: [AnalyticsOverviewService, AnalyticsReportService, DailyOpsService, WorkbenchService],
})
export class SalesAnalyticsModule {}
