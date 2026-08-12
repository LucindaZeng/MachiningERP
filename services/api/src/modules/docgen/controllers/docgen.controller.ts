import { PERMISSION_CODES } from '@machining-erp/shared'
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { MergeExportDto } from '../dto/merge-export.dto'
import { DocgenService } from '../services/docgen.service'
import { toGeneratedDocumentView } from '../services/generated-document-view.mapper'
import { MergeExportService } from '../services/merge-export.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { GeneratedDocumentView } from '../dto/generated-document-view.dto'

/**
 * 单据出具（docgen）。
 *
 * 端点只返回**生成记录**，不返回文件字节：文件一律经
 * `/files/generated-document/:id/preview-url` 与 `download-url` 取，
 * 那两个端点会验权、签短时效链接并逐次留审计。让出具端点直接吐字节，
 * 等于绕开这套已经建好的把关。
 *
 * 报关文件不在这里：它由 customs 的 `POST /customs-dossiers/:id/documents`
 * 触发，docgen 只是它背后的渲染实现（见 customs-render.adapter.ts）。
 */
@ApiTags('docgen')
@Controller('documents')
export class DocgenController {
  constructor(
    private readonly docgen: DocgenService,
    private readonly merge: MergeExportService,
  ) {}

  @Get()
  @ApiOperation({ summary: '某张单据出过哪些文件（按出具时间倒序）' })
  async list(
    @Query('sourceType') sourceType: string,
    @Query('sourceId') sourceId: string,
  ): Promise<GeneratedDocumentView[]> {
    const records = await this.docgen.list(sourceType, sourceId)
    return records.map(toGeneratedDocumentView)
  }

  @Get(':id')
  @ApiOperation({ summary: '生成记录详情' })
  async detail(@Param('id') id: string): Promise<GeneratedDocumentView> {
    return toGeneratedDocumentView(await this.docgen.detail(id))
  }

  @Post('quotations/:id')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '按受控模板出具报价单（国内/国外版式由单据自身决定）' })
  async quotation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GeneratedDocumentView> {
    return toGeneratedDocumentView(await this.docgen.issueQuotation(id, user))
  }

  @Post('cost-analyses/:id')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_APPROVE)
  @ApiOperation({ summary: '按 CNC 成本分析模板出具成本分析表' })
  async costAnalysis(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GeneratedDocumentView> {
    return toGeneratedDocumentView(await this.docgen.issueCostAnalysis(id, user))
  }

  @Post('statements/:id')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '出具客户对账单' })
  async statement(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GeneratedDocumentView> {
    return toGeneratedDocumentView(await this.docgen.issueStatement(id, user))
  }

  @Post('merge/quotations')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '多份报价单合并成一张比较平表' })
  async mergeQuotations(
    @Body() dto: MergeExportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GeneratedDocumentView> {
    return toGeneratedDocumentView(await this.merge.exportQuotations(dto.ids, user))
  }

  @Post('merge/cost-analyses')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.QUOTE_APPROVE)
  @ApiOperation({ summary: '多份成本分析合并成一张比较平表' })
  async mergeCostAnalyses(
    @Body() dto: MergeExportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GeneratedDocumentView> {
    return toGeneratedDocumentView(await this.merge.exportCostAnalyses(dto.ids, user))
  }
}
