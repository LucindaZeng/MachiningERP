import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'


import { Public } from '../../../common/decorators/public.decorator'
import { Ctx, type RequestContext } from '../../../common/decorators/request-context.decorator'
import { PasswordResetRequestService } from '../../identity'
import { PasswordResetRequestDto } from '../dto/password-reset-request.dto'

import type { PasswordResetRequestResultContract } from '@machining-erp/shared'

/** 忘记密码：提交重置申请给 IT 系统管理员（不做邮箱/短信自助找回）。 */
@ApiTags('auth')
@Controller('auth')
export class PasswordResetController {
  constructor(private readonly passwordResets: PasswordResetRequestService) {}

  @Public()
  @Post('password-reset-requests')
  @ApiOperation({ summary: '提交密码重置申请，由 IT 管理员核实身份后重置' })
  submit(
    @Body() dto: PasswordResetRequestDto,
    @Ctx() context: RequestContext,
  ): Promise<PasswordResetRequestResultContract> {
    return this.passwordResets.submit(dto, context.traceId)
  }
}
