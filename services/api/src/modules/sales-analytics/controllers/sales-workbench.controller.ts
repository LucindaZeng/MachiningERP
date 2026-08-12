import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { WorkbenchService } from '../services/workbench.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { SalesWorkbench } from '@machining-erp/shared'

/** 业务部工作台。待办与预警都从真实单据与通知流推导，不另建表。 */
@ApiTags('sales-analytics')
@Controller('sales')
export class SalesWorkbenchController {
  constructor(private readonly workbench: WorkbenchService) {}

  @Get('workbench')
  @ApiOperation({ summary: '工作台聚合：KPI 卡、待办、预警、审批时效' })
  async load(@CurrentUser() user: AuthenticatedUser): Promise<SalesWorkbench> {
    return this.workbench.workbench(user.userCode, new Date())
  }
}
