import { Module } from '@nestjs/common'

import { AuditModule } from '../audit'
import { ObjectStorageModule } from '../object-storage'

import { FilePreviewController } from './controllers/file-preview.controller'
import { DrawingVersionPreviewSource } from './repositories/drawing-version.source'
import { FILE_PREVIEW_SOURCES } from './repositories/file-preview-source.port'
import { OrderCustomerPoPreviewSource } from './repositories/order-customer-po.source'
import {
  FILE_PREVIEW_CONFIG,
  loadFilePreviewConfig,
} from './services/file-preview.config'
import { FilePreviewService } from './services/file-preview.service'

/**
 * file-preview：kkFileView 在线预览（deployment-environment.md 第 3 章）。
 *
 * resolver registry 就是下面这个数组。新增一种文件（质量文件、报关资料、
 * 发票扫描件）时只往数组里加一个 provider，service 与端点契约都不动。
 */
@Module({
  imports: [AuditModule, ObjectStorageModule],
  controllers: [FilePreviewController],
  providers: [
    { provide: FILE_PREVIEW_CONFIG, useFactory: () => loadFilePreviewConfig() },
    FilePreviewService,
    DrawingVersionPreviewSource,
    OrderCustomerPoPreviewSource,
    {
      provide: FILE_PREVIEW_SOURCES,
      inject: [DrawingVersionPreviewSource, OrderCustomerPoPreviewSource],
      useFactory: (
        drawings: DrawingVersionPreviewSource,
        orders: OrderCustomerPoPreviewSource,
      ) => [drawings, orders],
    },
  ],
  exports: [FilePreviewService],
})
export class FilePreviewModule {}
