import { PERMISSION_CODES, UPLOAD_ERRORS } from '@machining-erp/shared'
import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator'
import { BizError } from '../../../common/errors/biz-error'
import { UploadCustomerPoDto } from '../dto/upload-customer-po.dto'
import { CustomerPoUploadService } from '../services/customer-po-upload.service'

import type { AuthenticatedUser } from '../../../common/types/authenticated-user'
import type { CustomerPoUploadView } from '../dto/customer-po-upload-view.dto'

interface UploadedMultipartFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

/**
 * 客户订单原件上传（业务规格 4.1）。
 * 必传与否由 `order-prerequisites` 按订单类型判定，本端点只负责把文件放好。
 */
@ApiTags('contract-order')
@Controller('sales-orders/customer-po')
export class CustomerPoUploadController {
  constructor(private readonly uploads: CustomerPoUploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(PERMISSION_CODES.SALES_OPERATE)
  @ApiOperation({ summary: '上传客户订单原件；带 orderId 即刻挂单，不带则暂存返回对象键' })
  async upload(
    @UploadedFile() file: UploadedMultipartFile | undefined,
    @Body() dto: UploadCustomerPoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomerPoUploadView> {
    if (!file) throw new BizError(UPLOAD_ERRORS.FILE_REQUIRED)

    return this.uploads.upload(
      {
        orderId: dto.orderId ?? null,
        fileName: file.originalname,
        contentType: file.mimetype,
        content: file.buffer,
      },
      user,
    )
  }
}
