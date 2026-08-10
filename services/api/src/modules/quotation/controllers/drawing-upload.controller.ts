import { UPLOAD_ERRORS } from '@machining-erp/shared'
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { BizError } from '../../../common/errors/biz-error'
import { UploadDrawingDto } from '../dto/upload-drawing.dto'
import { DrawingUploadService } from '../services/drawing-upload.service'
import { toDrawingVersionView } from '../services/drawing-version-view.mapper'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { DrawingVersionView } from '../dto/drawing-version-view.dto'

/** multer 在内存里给到的文件形状；只用到这四个字段。 */
interface UploadedMultipartFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

/**
 * 图纸上传（业务规格 2.2）。放在 quotation 模块是因为图纸由报价环节上传，
 * 下游（核价、BOM）只引用不重传。
 */
@ApiTags('quotation')
@Controller('quotations/drawings')
export class DrawingUploadController {
  constructor(private readonly uploads: DrawingUploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传图纸，产生新的图纸版本（对象键带版本号，永不覆盖）' })
  async upload(
    @UploadedFile() file: UploadedMultipartFile | undefined,
    @Body() dto: UploadDrawingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DrawingVersionView> {
    if (!file) throw new BizError(UPLOAD_ERRORS.FILE_REQUIRED)

    const version = await this.uploads.upload(
      {
        drawingNo: dto.drawingNo,
        customerId: dto.customerId ?? null,
        title: dto.title ?? null,
        revision: dto.revision ?? null,
        fileName: file.originalname,
        contentType: file.mimetype,
        content: file.buffer,
      },
      user,
    )

    return toDrawingVersionView(version)
  }

  @Get(':id')
  @ApiOperation({ summary: '图纸版本详情（下游确认引用的是哪一版）' })
  async detail(@Param('id') id: string): Promise<DrawingVersionView> {
    return toDrawingVersionView(await this.uploads.loadVersion(id))
  }
}
