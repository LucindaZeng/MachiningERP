import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { ArchiveReceiptDto } from '../dto/archive-receipt.dto'
import { CorrectDossierDto } from '../dto/correct-dossier.dto'
import { CustomsActionDto } from '../dto/customs-action.dto'
import { CustomsDeclarationService } from '../services/customs-declaration.service'
import { CustomsReadService } from '../services/customs-read.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { CustomsDossierView } from '../dto/customs-dossier-view.dto'

/**
 * EXP-02 关务复核与 EXP-04 申报。
 *
 * 权限分工在这里看得最清楚：送审是业务的动作，复核、申报、更正、回执、放行
 * 一律要关务权限——「关务复核不可跳过」这条规则，落地就是这五个端点的注解。
 */
@ApiTags('customs')
@Controller('customs-dossiers')
export class CustomsFlowController {
  constructor(
    private readonly declarations: CustomsDeclarationService,
    private readonly reads: CustomsReadService,
  ) {}

  @Post(':id/submit-review')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: 'EXP-02 送关务复核' })
  async submitReview(
    @Param('id') id: string,
    @Body() dto: CustomsActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomsDossierView> {
    return this.reads.render(await this.declarations.submitForReview(id, dto.versionLock, user))
  }

  @Post(':id/approve-review')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.CUSTOMS_DECLARE)
  @ApiOperation({ summary: 'EXP-02 关务复核通过；要素不齐时拒绝' })
  async approveReview(
    @Param('id') id: string,
    @Body() dto: CustomsActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomsDossierView> {
    return this.reads.render(await this.declarations.approveReview(id, dto.versionLock, user))
  }

  @Post(':id/return-for-fix')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.CUSTOMS_DECLARE)
  @ApiOperation({ summary: 'EXP-02 复核退回补正（申报之后不再有这条回头路）' })
  async returnForFix(
    @Param('id') id: string,
    @Body() dto: CustomsActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomsDossierView> {
    return this.reads.render(await this.declarations.returnForFix(id, dto.versionLock, user))
  }

  @Post(':id/declare')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.CUSTOMS_DECLARE)
  @ApiOperation({ summary: 'EXP-04 申报：冻结本版清单快照，此后改动须走更正' })
  async declare(
    @Param('id') id: string,
    @Body() dto: CustomsActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomsDossierView> {
    return this.reads.render(await this.declarations.declare(id, dto.versionLock, user))
  }

  @Post(':id/correct')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.CUSTOMS_DECLARE)
  @ApiOperation({ summary: 'EXP-04 更正已申报资料并重报（理由必填）' })
  async correct(
    @Param('id') id: string,
    @Body() dto: CorrectDossierDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomsDossierView> {
    return this.reads.render(
      await this.declarations.correct(id, dto.versionLock, dto.reason, user),
    )
  }

  @Post(':id/receipt')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.CUSTOMS_DECLARE)
  @ApiOperation({ summary: 'EXP-04 申报回执归档（按申报版本各挂各的）' })
  async archiveReceipt(
    @Param('id') id: string,
    @Body() dto: ArchiveReceiptDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomsDossierView> {
    return this.reads.render(
      await this.declarations.archiveReceipt(id, dto.versionLock, dto.receiptNo, user),
    )
  }

  @Post(':id/release')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.CUSTOMS_DECLARE)
  @ApiOperation({ summary: '海关放行，单据到终点' })
  async release(
    @Param('id') id: string,
    @Body() dto: CustomsActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomsDossierView> {
    return this.reads.render(await this.declarations.release(id, dto.versionLock, user))
  }
}
