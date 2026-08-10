import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { CompleteBomDto } from '../dto/complete-bom.dto'
import { ReturnBomRequestDto } from '../dto/return-bom-request.dto'
import { VersionLockDto } from '../dto/version-lock.dto'
import { BomEngineeringService } from '../services/bom-engineering.service'
import { toBomRequestView } from '../services/bom-request-view.mapper'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { BomRequestView } from '../dto/bom-request-view.dto'

/**
 * BOM 申请：工程侧回传（ENG-05）。
 *
 * `complete-bom` 与 `complete-program` 是**两个独立端点**——
 * BOM 好了就能下单，程序另算，合并成一个端点就等于把两个开关焊死。
 */
@ApiTags('bom-request')
@Controller('bom-requests')
export class BomEngineeringController {
  constructor(private readonly engineering: BomEngineeringService) {}

  @Post(':id/claim')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.ENGINEERING_BOM_HANDLE)
  @ApiOperation({ summary: '工程接收，开始建立' })
  async claim(
    @Param('id') id: string,
    @Body() dto: VersionLockDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BomRequestView> {
    return toBomRequestView(await this.engineering.claim(id, dto.versionLock, user))
  }

  @Post(':id/return')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.ENGINEERING_BOM_HANDLE)
  @ApiOperation({ summary: '退回补料（必须写明缺什么）' })
  async returnToSales(
    @Param('id') id: string,
    @Body() dto: ReturnBomRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BomRequestView> {
    const record = await this.engineering.returnToSales(id, dto.versionLock, dto.reason, user)
    return toBomRequestView(record)
  }

  @Post(':id/complete-bom')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.ENGINEERING_BOM_HANDLE)
  @ApiOperation({ summary: 'BOM 建立完成并回填品号，通知业务员可以下单' })
  async completeBom(
    @Param('id') id: string,
    @Body() dto: CompleteBomDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BomRequestView> {
    const record = await this.engineering.completeBom(id, dto.versionLock, dto.productCode, user)
    return toBomRequestView(record)
  }

  @Post(':id/complete-program')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.ENGINEERING_BOM_HANDLE)
  @ApiOperation({ summary: '加工程序完成（不影响能否下单）' })
  async completeProgram(
    @Param('id') id: string,
    @Body() dto: VersionLockDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BomRequestView> {
    return toBomRequestView(await this.engineering.completeProgram(id, dto.versionLock, user))
  }
}
