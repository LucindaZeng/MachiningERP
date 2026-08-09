import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'


import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { Public } from '../../../common/decorators/public.decorator'
import { Ctx, type RequestContext } from '../../../common/decorators/request-context.decorator'
import { LoginDto } from '../dto/login.dto'
import { CaptchaService } from '../services/captcha.service'
import { LoginService } from '../services/login.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type {
  CaptchaChallengeContract,
  LoginResultContract,
  LoginUserContract,
} from '@machining-erp/shared'

/** 会话相关端点。controller 只做 HTTP 编解码，业务规则全部在 service 里。 */
@ApiTags('auth')
@Controller('auth')
export class AuthSessionController {
  constructor(
    private readonly loginService: LoginService,
    private readonly captchaService: CaptchaService,
  ) {}

  @Public()
  @Get('captcha')
  @ApiOperation({ summary: '获取图形验证码挑战（连续登录失败 3 次后必填）' })
  issueCaptcha(@Ctx() context: RequestContext): Promise<CaptchaChallengeContract> {
    return this.captchaService.issue(context.ip)
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '登录并签发 JWT' })
  login(@Body() dto: LoginDto, @Ctx() context: RequestContext): Promise<LoginResultContract> {
    return this.loginService.login(dto, {
      ip: context.ip,
      userAgent: context.userAgent,
      traceId: context.traceId,
    })
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: '注销当前会话（服务端立即撤销 token）' })
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.loginService.logout(user.tokenId)
  }

  @Get('me')
  @ApiOperation({ summary: '当前登录用户与权限点集合' })
  me(@CurrentUser() user: AuthenticatedUser): LoginUserContract {
    return {
      id: user.userId,
      userCode: user.userCode,
      account: '',
      displayName: user.displayName,
      department: user.department,
      roles: user.roles,
      permissions: user.permissions,
    }
  }
}
