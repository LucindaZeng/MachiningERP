import { normalizePageQuery, PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { CreateCustomerDto } from '../dto/create-customer.dto'
import { UpdateCustomerDto } from '../dto/update-customer.dto'
import { CustomerUpdateService } from '../services/customer-update.service'
import { CustomerService } from '../services/customer.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { CustomerView } from '../dto/customer-view.dto'
import type { CompletenessResult } from '../services/customer-completeness.rules'
import type { UpdateCustomerResult } from '../services/customer-update.service'

/** 客户主数据。返回体的字段裁剪由 service 层统一处理，controller 不做权限判断。 */
@ApiTags('masterdata')
@Controller('customers')
export class CustomerController {
  constructor(
    private readonly customers: CustomerService,
    private readonly updates: CustomerUpdateService,
  ) {}

  @Get()
  @ApiOperation({ summary: '客户列表；无 customer.view-all 时只返回本人负责的客户' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<{ data: CustomerView[]; meta: { page: number; pageSize: number; total: number } }> {
    const query = normalizePageQuery({ page: Number(page), pageSize: Number(pageSize) })
    const result = await this.customers.list({ q, ...query }, user)

    return { data: result.items, meta: { ...query, total: result.total } }
  }

  @Get(':id')
  @ApiOperation({ summary: '客户详情；越权返回 404 而不是 403' })
  detail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<CustomerView> {
    return this.customers.detail(id, user)
  }

  @Get(':id/completeness')
  @ApiOperation({ summary: '下单前档案完整性检查，返回缺失项清单' })
  completeness(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CompletenessResult> {
    return this.customers.completeness(id, user)
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_EDIT)
  @ApiOperation({ summary: '建客户档案；编号由系统生成，不接受入参 code' })
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomerView> {
    return this.customers.create(dto, user)
  }

  @Put(':id')
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_EDIT)
  @ApiOperation({ summary: '改档；敏感字段转为变更申请，审批通过后才生效' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UpdateCustomerResult> {
    return this.updates.update(id, dto, user)
  }
}
