import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { EcnActionDto } from '../dto/ecn-action.dto'
import { EnterAffectedQtyDto } from '../dto/enter-affected-qty.dto'
import { EcnProductionService } from '../services/ecn-production.service'
import { EcnReadService } from '../services/ecn-read.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { EcnRequestView } from '../dto/ecn-view.dto'

/**
 * PMC 侧：已投产数量的清点录入与返工发起（业务规格第 6 章，新增规则）。
 *
 * 单独成 controller 而不是塞进评估或发布那两支——**执行人不同**。
 * 前两支是工程岗，这一支是 PMC；按角色分文件，权限装饰器也就不会在同一个
 * 文件里混着两种，读的人不必逐个方法去数。
 */
@ApiTags('ecn-request')
@Controller('engineering-changes')
export class EcnProductionController {
  constructor(
    private readonly production: EcnProductionService,
    private readonly reads: EcnReadService,
  ) {}

  @Post(':id/affected-quantities')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.ORDER_TRACKING_VIEW)
  @ApiOperation({
    summary: 'PMC 录入已投产（车床/CNC 已动）数量；返工发起后不可再改',
  })
  async enterQuantities(
    @Param('id') id: string,
    @Body() dto: EnterAffectedQtyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EcnRequestView> {
    const updated = await this.production.enterQuantities(
      id,
      dto.versionLock,
      dto.lines.map((line) => ({
        productName: line.productName,
        drawingNo: line.drawingNo,
        affectedQty: line.affectedQty,
        note: line.note ?? null,
      })),
      user,
    )
    return this.reads.render(updated)
  }

  @Post(':id/initiate-rework')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.ORDER_TRACKING_VIEW)
  @ApiOperation({
    summary: '发起返工：发出返工事件（带新旧图纸版本与逐行数量）并锁死数量',
  })
  async initiateRework(
    @Param('id') id: string,
    @Body() dto: EcnActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EcnRequestView> {
    return this.reads.render(await this.production.initiateRework(id, dto.versionLock, user))
  }
}
