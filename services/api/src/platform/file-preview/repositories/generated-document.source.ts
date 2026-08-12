import { PERMISSION_CODES } from '@machining-erp/shared'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'
import { PREVIEW_OWNER_TYPES, type PreviewOwnerType } from '../constants/preview-owner-types'

import type {
  FilePreviewSource,
  PreviewViewer,
  ResolvedPreviewFile,
} from './file-preview-source.port'

/**
 * 会看到 docgen 生成物的岗位：出单的业务、核价的报价工程师。
 * 成本分析里有成本，因此不放给只有 `sales.operate` 之外的角色。
 */
const GENERATED_VIEWER_PERMISSIONS: readonly string[] = [
  PERMISSION_CODES.SALES_OPERATE,
  PERMISSION_CODES.QUOTE_APPROVE,
]

/**
 * docgen 生成物 → 文件（development-guide §6.1：新文件种类必须登记 resolver）。
 *
 * 与报关文件那支 resolver 的差别只有一处：这里的 `objectKey` **一定有值**。
 * 生成记录是「文件落盘成功之后」才写的，因此不存在「登记了但没有文件」的中间态——
 * 报关那边有，是因为它的版本链在 docgen 接入前就先跑起来了。
 */
@Injectable()
export class GeneratedDocumentPreviewSource implements FilePreviewSource {
  readonly ownerType: PreviewOwnerType = PREVIEW_OWNER_TYPES.GENERATED_DOCUMENT

  constructor(private readonly prisma: PrismaService) {}

  async resolve(ownerId: string, viewer: PreviewViewer): Promise<ResolvedPreviewFile | null> {
    if (!GENERATED_VIEWER_PERMISSIONS.some((code) => viewer.permissions.includes(code))) {
      return null
    }

    const document = await this.prisma.generatedDocument.findUnique({ where: { id: ownerId } })
    if (!document) return null

    return {
      objectKey: document.objectKey,
      fileName: document.fileName,
      docType: document.sourceType,
      docId: document.sourceId,
      docLabel: `${document.sourceDocNo} ${document.templateId} v${document.templateVersion}`,
    }
  }
}
