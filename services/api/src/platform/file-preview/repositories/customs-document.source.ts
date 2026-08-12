import { PERMISSION_CODES } from '@machining-erp/shared'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'
import { PREVIEW_OWNER_TYPES, type PreviewOwnerType } from '../constants/preview-owner-types'

import type {
  FilePreviewSource,
  PreviewViewer,
  ResolvedPreviewFile,
} from './file-preview-source.port'

/** 会因职责需要看报关文件的岗位：出单的业务、复核申报的关务。 */
const CUSTOMS_VIEWER_PERMISSIONS: readonly string[] = [
  PERMISSION_CODES.SALES_OPERATE,
  PERMISSION_CODES.CUSTOMS_DECLARE,
]

/**
 * 报关文件版本 → 文件（development-guide §6.1：新文件种类必须登记 resolver）。
 *
 * 这是系统里**第一类「生成」出来的文件**，与图纸那种上传件有两点不同，
 * 都体现在下面的实现里：
 *
 * 1. **可能还没有文件。** docgen 落地之前，生成动作只登记版本与汇率快照，
 *    `objectKey` 是空的。这时一律按「不存在」处理返回 null——
 *    让用户看到「尚未生成」，而不是让预览服务去取一个不存在的对象再回一个 500。
 * 2. **版本即身份。** ownerId 指向某一**版**，不是「这份文件的最新版」。
 *    报关文件的历史版本必须能原样调阅，那正是不可变版本链存在的意义。
 */
@Injectable()
export class CustomsDocumentPreviewSource implements FilePreviewSource {
  readonly ownerType: PreviewOwnerType = PREVIEW_OWNER_TYPES.CUSTOMS_DOCUMENT

  constructor(private readonly prisma: PrismaService) {}

  async resolve(ownerId: string, viewer: PreviewViewer): Promise<ResolvedPreviewFile | null> {
    if (!CUSTOMS_VIEWER_PERMISSIONS.some((code) => viewer.permissions.includes(code))) {
      return null
    }

    const document = await this.prisma.customsDocument.findUnique({
      where: { id: ownerId },
      include: { dossier: { select: { docNo: true, ownerUserCode: true } } },
    })
    if (!document) return null

    // 还没真正出文件（docgen 未接入，或渲染失败）——对外与「不存在」一样
    if (!document.objectKey || !document.fileName) return null

    return {
      objectKey: document.objectKey,
      fileName: document.fileName,
      docType: 'CustomsDocument',
      docId: document.id,
      docLabel: `${document.dossier.docNo} ${document.kind} V${document.version}`,
    }
  }
}
