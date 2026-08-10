import { Controller, Get, Param } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { FilePreviewService } from '../services/file-preview.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { PreviewUrlView } from '../dto/preview-url-view.dto'

/**
 * 在线预览端点。按 `(ownerType, ownerId)` 定位文件——系统里还没有统一的文件表，
 * 造一个通用 file id 等于先发明一张表。
 *
 * 业务模块不 import 本能力的任何内部文件，前端只传归属类型与单据主键。
 */
@ApiTags('file-preview')
@Controller('files')
export class FilePreviewController {
  constructor(private readonly preview: FilePreviewService) {}

  @Get(':ownerType/:ownerId/preview-url')
  @ApiOperation({ summary: '签发 kkFileView 预览地址（短时效预签名 + 水印，逐次审计）' })
  async previewUrl(
    @Param('ownerType') ownerType: string,
    @Param('ownerId') ownerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PreviewUrlView> {
    return this.preview.previewUrlFor(ownerType, ownerId, user)
  }

  @Get(':ownerType/:ownerId/download-url')
  @ApiOperation({ summary: '签发下载地址，供不支持预览（415）的类型回落' })
  async downloadUrl(
    @Param('ownerType') ownerType: string,
    @Param('ownerId') ownerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PreviewUrlView> {
    return this.preview.downloadUrlFor(ownerType, ownerId, user)
  }
}
