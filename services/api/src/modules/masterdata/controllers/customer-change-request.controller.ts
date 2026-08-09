import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { RejectChangeRequestDto } from '../dto/reject-change-request.dto'
import { CustomerChangeApprovalService } from '../services/customer-change-approval.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { CustomerChangeRequestView } from '../dto/customer-change-request-view.dto'

/** 客户敏感字段变更申请的审批闭环。 */
@ApiTags('masterdata')
@Controller('customer-change-requests')
export class CustomerChangeRequestController {
  constructor(private readonly approvals: CustomerChangeApprovalService) {}

  @Get('pending/:customerId')
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_SENSITIVE_EDIT)
  @ApiOperation({ summary: '某客户待审批的敏感字段变更' })
  listPending(@Param('customerId') customerId: string): Promise<CustomerChangeRequestView[]> {
    return this.approvals.listPending(customerId)
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_SENSITIVE_EDIT)
  @ApiOperation({ summary: '通过变更申请并落库；不得审批自己提交的申请' })
  approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomerChangeRequestView> {
    return this.approvals.approve(id, user)
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_SENSITIVE_EDIT)
  @ApiOperation({ summary: '驳回变更申请，理由必填并回传提交人' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectChangeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomerChangeRequestView> {
    return this.approvals.reject(id, dto.reason, user)
  }
}
