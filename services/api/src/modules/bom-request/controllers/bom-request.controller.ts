import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { BomRequestPayloadDto } from '../dto/bom-request-payload.dto'
import { ListBomRequestsDto } from '../dto/list-bom-requests.dto'
import { UpdateBomRequestDto } from '../dto/update-bom-request.dto'
import { VersionLockDto } from '../dto/version-lock.dto'
import { BomQuotationContextService } from '../services/bom-quotation-context.service'
import { toBomRequestDraft } from '../services/bom-request-input.mapper'
import { toBomRequestView } from '../services/bom-request-view.mapper'
import { BomRequestService } from '../services/bom-request.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { BomRequestView } from '../dto/bom-request-view.dto'

/** BOM 申请：业务侧（业务规格第 5 章）。工程侧回传见 bom-engineering.controller。 */
@ApiTags('bom-request')
@Controller('bom-requests')
export class BomRequestController {
  constructor(
    private readonly requests: BomRequestService,
    private readonly context: BomQuotationContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'BOM 申请列表' })
  async list(@Query() query: ListBomRequestsDto): Promise<BomRequestView[]> {
    const records = await this.requests.list({
      ...query,
      submittedFrom: query.submittedFrom ? new Date(query.submittedFrom) : undefined,
      submittedTo: query.submittedTo ? new Date(query.submittedTo) : undefined,
      limit: 200,
    })
    return records.map(toBomRequestView)
  }

  @Get(':id')
  @ApiOperation({ summary: 'BOM 申请详情' })
  async detail(@Param('id') id: string): Promise<BomRequestView> {
    return toBomRequestView(await this.requests.load(id))
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '提起 BOM 申请（引用报价产品，图纸不重复上传）' })
  async create(
    @Body() dto: BomRequestPayloadDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BomRequestView> {
    const facts = await this.context.factsFor(dto)
    const record = await this.requests.create(toBomRequestDraft(dto, user.userCode), facts, user)
    return toBomRequestView(record)
  }

  @Put(':id')
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '修改草稿或被退回的申请' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBomRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BomRequestView> {
    const facts = await this.context.factsFor(dto)
    const record = await this.requests.updateDraft(
      id,
      dto.versionLock,
      toBomRequestDraft(dto, user.userCode),
      facts,
      user,
    )
    return toBomRequestView(record)
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '提交给工程部（退回后补料重提也走这里）' })
  async submit(
    @Param('id') id: string,
    @Body() dto: VersionLockDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BomRequestView> {
    return toBomRequestView(await this.requests.submit(id, dto.versionLock, user))
  }
}
