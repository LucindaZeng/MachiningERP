import { Global, Module } from '@nestjs/common'

import {
  OBJECT_STORAGE_CONFIG,
  loadObjectStorageConfig,
} from './services/object-storage.config'
import { ObjectStorageService } from './services/object-storage.service'

/**
 * object-storage：MinIO / S3 访问的唯一出口。
 * 后续的图纸上传、docgen 导出都复用本 provider，不各建一个客户端。
 */
@Global()
@Module({
  providers: [
    { provide: OBJECT_STORAGE_CONFIG, useFactory: () => loadObjectStorageConfig() },
    ObjectStorageService,
  ],
  exports: [ObjectStorageService],
})
export class ObjectStorageModule {}
