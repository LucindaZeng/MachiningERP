import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { EcnActionDto } from '../dto/ecn-action.dto'
import { RejectEcnDto } from '../dto/reject-ecn.dto'
import { EcnApprovalService } from '../services/ecn-approval.service'
import { EcnReadService } from '../services/ecn-read.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { EcnRequestView } from '../dto/ecn-view.dto'

/**
 * 工程变更的**批准与执行**（ECN-04 ~ ECN-05）。
 *
 * 批准是不可逆边界：过了这一步，关联版本已经发布出去，此后要改只能另开一张 ECN。
 * 因此这四个动作单独成文件——它们的共同点是「已经对外生效或即将生效」。
 */
@ApiTags('ecn-request')
@Controller('engineering-changes')
export class EcnReleaseController {
  constructor(
    private readonly approvals: EcnApprovalService,
    private readonly reads: EcnReadService,
  ) {}

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_APPROVE)
  @ApiOperation({ summary: 'ECN-04 批准发布；改图未同步工艺路线或改工序未指定批次会被拒绝' })
  async approve(
    @Param('id') id: string,
    @Body() dto: EcnActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EcnRequestView> {
    return this.reads.render(await this.approvals.approve(id, dto.versionLock, user))
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_APPROVE)
  @ApiOperation({ summary: '驳回变更，中文理由必填并随通知送达业务员' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectEcnDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EcnRequestView> {
    return this.reads.render(await this.approvals.reject(id, dto.versionLock, dto.reason, user))
  }

  @Post(':id/execute')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_APPROVE)
  @ApiOperation({ summary: 'ECN-05 转入执行与批次切换' })
  async execute(
    @Param('id') id: string,
    @Body() dto: EcnActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EcnRequestView> {
    return this.reads.render(await this.approvals.startExecution(id, dto.versionLock, user))
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_APPROVE)
  @ApiOperation({ summary: 'ECN-05 执行完毕结案，并通知发起的业务员' })
  async close(
    @Param('id') id: string,
    @Body() dto: EcnActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EcnRequestView> {
    return this.reads.render(await this.approvals.close(id, dto.versionLock, user))
  }
}
