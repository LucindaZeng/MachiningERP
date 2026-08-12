import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { AssessImpactDto } from '../dto/assess-impact.dto'
import { EcnActionDto } from '../dto/ecn-action.dto'
import { SignoffEcnDto } from '../dto/signoff-ecn.dto'
import { EcnApprovalService } from '../services/ecn-approval.service'
import { EcnImpactService } from '../services/ecn-impact.service'
import { EcnReadService } from '../services/ecn-read.service'
import { EcnRequestService } from '../services/ecn-request.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { EcnRequestView } from '../dto/ecn-view.dto'

/**
 * 工程变更的**评估与会签**（ECN-02 ~ ECN-03）。
 *
 * 批准及其之后的动作在 ecn-release.controller.ts。按**流程阶段**拆，
 * 而不是按「一个 controller 塞不下」硬切——这样每个文件读起来仍是一件完整的事。
 */
@ApiTags('ecn-request')
@Controller('engineering-changes')
export class EcnAssessmentController {
  constructor(
    private readonly requests: EcnRequestService,
    private readonly impacts: EcnImpactService,
    private readonly approvals: EcnApprovalService,
    private readonly reads: EcnReadService,
  ) {}

  @Post(':id/start-assessment')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_APPROVE)
  @ApiOperation({ summary: 'ECN-02 工程认领并开始影响评估' })
  async startAssessment(
    @Param('id') id: string,
    @Body() dto: EcnActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EcnRequestView> {
    return this.reads.render(await this.requests.startAssessment(id, dto.versionLock, user))
  }

  @Post(':id/return-for-detail')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_APPROVE)
  @ApiOperation({ summary: '退回业务补充说明——看不懂的变更不该硬着头皮评' })
  async returnForDetail(
    @Param('id') id: string,
    @Body() dto: EcnActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EcnRequestView> {
    return this.reads.render(await this.requests.returnForDetail(id, dto.versionLock, user))
  }

  @Post(':id/assess')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_APPROVE)
  @ApiOperation({ summary: 'ECN-02 保存影响评估（在制/已采购/已完工/已发货四项）' })
  async assess(
    @Param('id') id: string,
    @Body() dto: AssessImpactDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EcnRequestView> {
    const updated = await this.impacts.assess(
      id,
      dto.versionLock,
      {
        impacts: dto.impacts.map((item) => ({
          scope: item.scope,
          quantity: item.quantity,
          amountMinor: item.amountMinor ?? null,
          note: item.note,
        })),
        routingUpdated: dto.routingUpdated,
        effectiveBatch: dto.effectiveBatch ?? null,
        needRequote: dto.needRequote,
        needOrderReapproval: dto.needOrderReapproval,
      },
      user,
    )
    return this.reads.render(updated)
  }

  @Post(':id/submit-signoff')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_APPROVE)
  @ApiOperation({ summary: 'ECN-03 送跨部门会签；四项影响未评全会被拒绝' })
  async submitForSignoff(
    @Param('id') id: string,
    @Body() dto: EcnActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EcnRequestView> {
    return this.reads.render(await this.impacts.submitForSignoff(id, dto.versionLock, user))
  }

  @Post(':id/signoff')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_APPROVE)
  @ApiOperation({ summary: 'ECN-03 记录会签（各部门模块上线前由工程代签，留痕标记）' })
  async signoff(
    @Param('id') id: string,
    @Body() dto: SignoffEcnDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EcnRequestView> {
    const updated = await this.approvals.recordSignoffs(
      id,
      dto.versionLock,
      dto.opinion ?? null,
      user,
    )
    return this.reads.render(updated)
  }
}
