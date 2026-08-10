import { FILE_PREVIEW_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../audit'
import { ObjectStorageService } from '../../object-storage'
import { isPreviewOwnerType } from '../constants/preview-owner-types'
import { isPreviewable } from '../constants/previewable-extensions'
import {
  FILE_PREVIEW_SOURCES,
  type FilePreviewSource,
  type PreviewViewer,
  type ResolvedPreviewFile,
} from '../repositories/file-preview-source.port'

import {
  FILE_PREVIEW_CONFIG,
  loadFilePreviewConfig,
  type FilePreviewConfig,
} from './file-preview.config'
import { buildPreviewUrl, composeWatermark } from './preview-url.builder'

import type { PreviewUrlView } from '../dto/preview-url-view.dto'

/**
 * 在线预览（deployment-environment.md 第 3 章）。
 *
 * 权限收口在我方后端：kkFileView 只拿到一个几分钟内有效的预签名 URL，
 * **永远不给它任何存储凭证**。链路是
 * resolver 判权限取文件 → 用「容器可达」端点签名 → Base64+URL 编码拼预览地址 → 写审计。
 *
 * 平台能力，零业务逻辑：本服务不认识报价单、BOM、订单，
 * 只认识 `(ownerType, ownerId)` 和 registry 里注册的 resolver。
 */
@Injectable()
export class FilePreviewService {
  private readonly sources: Map<string, FilePreviewSource>

  constructor(
    private readonly storage: ObjectStorageService,
    private readonly audit: AuditService,
    @Inject(FILE_PREVIEW_SOURCES) sources: readonly FilePreviewSource[],
    @Inject(FILE_PREVIEW_CONFIG)
    private readonly config: FilePreviewConfig = loadFilePreviewConfig(),
  ) {
    this.sources = new Map(sources.map((source) => [source.ownerType, source]))
  }

  async previewUrlFor(
    ownerType: string,
    ownerId: string,
    viewer: PreviewViewer,
  ): Promise<PreviewUrlView> {
    const file = await this.resolve(ownerType, ownerId, viewer)

    // 渲染不了的类型当场回 415，让前端回落到下载，而不是把用户丢给 kkFileView 的报错页
    if (!isPreviewable(file.fileName)) {
      throw new BizError(FILE_PREVIEW_ERRORS.UNSUPPORTED, {
        message: `${file.fileName} 不支持在线预览，请下载后查看`,
        details: { fileName: file.fileName, docType: file.docType, docId: file.docId },
      })
    }

    const presignedUrl = await this.storage.presign(file.objectKey, {
      // 关键：签给 kkFileView 容器可达的端点，不是 localhost
      audience: 'preview',
      ttlSeconds: this.config.ttlSeconds,
    })
    const watermarkText = composeWatermark(viewer.displayName, viewer.userCode)

    await this.recordIssuance(file, viewer, ownerType)

    return {
      previewUrl: buildPreviewUrl({
        baseUrl: this.config.baseUrl,
        presignedUrl,
        fileName: file.fileName,
        watermarkText,
      }),
      fileName: file.fileName,
      expiresInSeconds: this.config.ttlSeconds,
      watermarkText,
    }
  }

  /** 下载回落：签给**浏览器**可达的端点，并带上 content-disposition。 */
  async downloadUrlFor(
    ownerType: string,
    ownerId: string,
    viewer: PreviewViewer,
  ): Promise<PreviewUrlView> {
    const file = await this.resolve(ownerType, ownerId, viewer)
    const downloadUrl = await this.storage.presign(file.objectKey, {
      audience: 'browser',
      ttlSeconds: this.config.ttlSeconds,
      downloadFileName: file.fileName,
    })

    await this.recordIssuance(file, viewer, ownerType, 'file-preview.download')

    return {
      previewUrl: downloadUrl,
      fileName: file.fileName,
      expiresInSeconds: this.config.ttlSeconds,
      watermarkText: '',
    }
  }

  /** 未知归属类型 400；解析不到或无权一律 404，两者对外不可区分。 */
  private async resolve(
    ownerType: string,
    ownerId: string,
    viewer: PreviewViewer,
  ): Promise<ResolvedPreviewFile> {
    if (!isPreviewOwnerType(ownerType)) {
      throw new BizError(FILE_PREVIEW_ERRORS.UNKNOWN_OWNER_TYPE, {
        details: { ownerType },
      })
    }

    const source = this.sources.get(ownerType)
    if (!source) throw new BizError(FILE_PREVIEW_ERRORS.UNKNOWN_OWNER_TYPE, { details: { ownerType } })

    const file = await source.resolve(ownerId, viewer)
    if (!file) throw new BizError(FILE_PREVIEW_ERRORS.NOT_FOUND)

    return file
  }

  /** 每一次签发都留痕：谁、哪个文件、挂在哪张单据上、什么时候。 */
  private recordIssuance(
    file: ResolvedPreviewFile,
    viewer: PreviewViewer,
    ownerType: string,
    action = 'file-preview.issue',
  ): Promise<void> {
    return this.audit.record({
      actorUserCode: viewer.userCode,
      action,
      entityType: file.docType,
      entityId: file.docId,
      after: {
        ownerType,
        docLabel: file.docLabel,
        fileName: file.fileName,
        objectKey: file.objectKey,
        ttlSeconds: this.config.ttlSeconds,
      },
    })
  }
}
