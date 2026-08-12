import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { AnalyticsOverviewService } from '../services/analytics-overview.service'
import { AnalyticsReportService } from '../services/analytics-report.service'
import { DailyOpsService } from '../services/daily-ops.service'

import type {
  CostReports,
  DailyOpsReport,
  MarketReports,
  OrderExtraReports,
  SalesAnalytics,
  SalesReports,
} from '@machining-erp/shared'

/**
 * 业务部经营分析（规格第 11 章）。
 *
 * **全部只读**：本 controller 一个写端点都没有，模块也没有自己的表。
 * 分析层只聚合别的模块已经产生的事实——口径属于产生数据的那个模块。
 */
@ApiTags('sales-analytics')
@Controller('sales')
export class SalesAnalyticsController {
  constructor(
    private readonly overview: AnalyticsOverviewService,
    private readonly reports: AnalyticsReportService,
    private readonly dailyOps: DailyOpsService,
  ) {}

  @Get('analytics')
  @ApiOperation({ summary: '经营分析看板首屏（趋势、排行、结构、漏斗）' })
  async analytics(): Promise<SalesAnalytics> {
    return this.overview.overview(new Date())
  }

  @Get('reports')
  @ApiOperation({ summary: '六大类报表明细' })
  async salesReports(): Promise<SalesReports> {
    return this.reports.salesReports(new Date())
  }

  @Get('reports/cost-variance')
  @ApiOperation({ summary: '成本偏差与审核时效（成本面板待成本模块上线）' })
  async costReports(): Promise<CostReports> {
    return this.reports.costReports()
  }

  @Get('reports/order-extra')
  @ApiOperation({ summary: '订单结构、在手订单 Backlog、样品与备料' })
  async orderReports(): Promise<OrderExtraReports> {
    return this.reports.orderReports()
  }

  @Get('reports/market')
  @ApiOperation({ summary: '客户流失预警、工艺分布、出货达成与退货责任' })
  async marketReports(): Promise<MarketReports> {
    return this.reports.marketReports(new Date())
  }

  @Get('reports/daily-ops')
  @ApiOperation({ summary: '每日接单量、出货量与未完成订单存量（近 30 天）' })
  async dailyOpsReport(): Promise<DailyOpsReport> {
    return this.dailyOps.report(new Date())
  }
}
