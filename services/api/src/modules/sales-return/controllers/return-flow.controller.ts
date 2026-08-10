import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { JudgeReturnDto } from '../dto/judge-return.dto'
import { ReceiveGoodsDto } from '../dto/receive-goods.dto'
import { RejectReturnDto } from '../dto/reject-return.dto'
import { ReturnActionDto } from '../dto/return-action.dto'
import { SubmitDispositionDto } from '../dto/submit-disposition.dto'
import { ReturnFlowService } from '../services/return-flow.service'
import { toDispositionInputs, toJudgeInputs } from '../services/return-input.mapper'
import { ReturnReadService } from '../services/return-read.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { SalesReturnView } from '../dto/sales-return-view.dto'

/**
 * RMA-02~05 的节点推进。
 *
 * 权限分工在这里看得最清楚：判定要品质权限、处置与结案要业务权限，
 * 批准则视是否涉及退款 / 补货 / 让步在服务层动态升级到财务。
 * 「批准」这一路故意不挂静态 @RequirePermissions——静态注解表达不了这种条件升级。
 */
@ApiTags('sales-return')
@Controller('sales-returns')
export class ReturnFlowController {
  constructor(
    private readonly flow: ReturnFlowService,
    private readonly reads: ReturnReadService,
  ) {}

  @Post(':id/respond')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: 'RMA-01→02 首次响应客户并转品质判定（SLA 口径，天然只有一次）' })
  async respond(
    @Param('id') id: string,
    @Body() dto: ReturnActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalesReturnView> {
    return this.reads.render(await this.flow.respond(id, dto.versionLock, user))
  }

  @Post(':id/judge')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUALITY_RMA_JUDGE)
  @ApiOperation({ summary: 'RMA-02 品质逐行判定责任归属' })
  async judge(
    @Param('id') id: string,
    @Body() dto: JudgeReturnDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalesReturnView> {
    return this.reads.render(
      await this.flow.judge(id, dto.versionLock, toJudgeInputs(dto), user),
    )
  }

  @Post(':id/disposition')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: 'RMA-03 提交逐行处置方案；涉及退款 / 补货 / 让步自动升级财务审批' })
  async disposition(
    @Param('id') id: string,
    @Body() dto: SubmitDispositionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalesReturnView> {
    return this.reads.render(
      await this.flow.submitDisposition(id, dto.versionLock, toDispositionInputs(dto), user),
    )
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'RMA-03 批准处置方案（涉及财务时需财务权限，服务层动态判定）' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ReturnActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalesReturnView> {
    return this.reads.render(await this.flow.approve(id, dto.versionLock, user))
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUALITY_RMA_JUDGE)
  @ApiOperation({ summary: '判定客诉不成立（理由必填）' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectReturnDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalesReturnView> {
    return this.reads.render(await this.flow.reject(id, dto.versionLock, dto.reason, user))
  }

  @Post(':id/receive')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: 'RMA-04 登记不良品实物入库；返工行必须先过这一步' })
  async receive(
    @Param('id') id: string,
    @Body() dto: ReceiveGoodsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalesReturnView> {
    return this.reads.render(await this.flow.receiveGoods(id, dto.versionLock, dto.lines, user))
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: 'RMA-05 结案：逐行闸门通过后锁死金额，对账单据此计入退货折让' })
  async close(
    @Param('id') id: string,
    @Body() dto: ReturnActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalesReturnView> {
    return this.reads.render(await this.flow.close(id, dto.versionLock, user))
  }
}
