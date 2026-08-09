import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'


import { Public } from '../../../common/decorators/public.decorator'
import { Ctx, type RequestContext } from '../../../common/decorators/request-context.decorator'
import { AccountAvailabilityService, AccountRequestService } from '../../identity'
import { AccountAvailabilityDto } from '../dto/account-availability.dto'
import { AccountRequestDto } from '../dto/account-request.dto'

import type {
  AccountAvailabilityContract,
  AccountRequestResultContract,
} from '@machining-erp/shared'

/** 登录页「申请账户」。业务由 identity 模块提供，本 controller 只做编解码。 */
@ApiTags('auth')
@Controller('auth')
export class AccountRequestController {
  constructor(
    private readonly availability: AccountAvailabilityService,
    private readonly accountRequests: AccountRequestService,
  ) {}

  @Public()
  @Post('account-availability')
  @HttpCode(200)
  @ApiOperation({ summary: '用户名可用性校验（离职释放的用户名可重新登记）' })
  check(@Body() dto: AccountAvailabilityDto): Promise<AccountAvailabilityContract> {
    return this.availability.check(dto.account)
  }

  @Public()
  @Post('account-requests')
  @ApiOperation({ summary: '提交账户申请，注册即发放永不复用的唯一编码' })
  submit(
    @Body() dto: AccountRequestDto,
    @Ctx() context: RequestContext,
  ): Promise<AccountRequestResultContract> {
    return this.accountRequests.submit(dto, context.traceId)
  }
}
