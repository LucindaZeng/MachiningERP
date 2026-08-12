import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { CreateEcnDto } from '../dto/create-ecn.dto'
import { ListEcnDto } from '../dto/list-ecn.dto'
import { EcnReadService } from '../services/ecn-read.service'
import { EcnRequestFacade } from '../services/ecn-request.facade'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { EcnRequestView } from '../dto/ecn-view.dto'

/**
 * 工程变更申请：查询与提交（ECN-01）。
 * 评估、会签、批准、执行另见 ecn-flow.controller.ts——拆开才守得住每个 controller ≤ 8 路由。
 */
@ApiTags('ecn-request')
@Controller('engineering-changes')
export class EcnController {
  constructor(
    private readonly reads: EcnReadService,
    private readonly facade: EcnRequestFacade,
  ) {}

  @Get()
  @ApiOperation({ summary: '工程变更申请列表（可按客户、订单、状态、类型过滤）' })
  async list(@Query() query: ListEcnDto): Promise<EcnRequestView[]> {
    // 过滤值的枚举收敛在 read service 里做：controller 不认识 Prisma 类型
    return this.reads.list(query)
  }

  @Get(':id')
  @ApiOperation({ summary: '变更申请详情（含影响评估、变更链路、会签与节点计时）' })
  async detail(@Param('id') id: string): Promise<EcnRequestView> {
    return this.reads.detail(id)
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({
    summary: 'ECN-01 提交工程变更申请；改数量/交期/价格会被拒绝并指向正确路径',
  })
  async create(
    @Body() dto: CreateEcnDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EcnRequestView> {
    return this.facade.createAndView(dto, user)
  }
}
