import { PERMISSION_CODES } from '@machining-erp/shared'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'
import { PREVIEW_OWNER_TYPES, type PreviewOwnerType } from '../constants/preview-owner-types'

import type {
  FilePreviewSource,
  PreviewViewer,
  ResolvedPreviewFile,
} from './file-preview-source.port'

/** 会因职责需要看图纸的岗位：业务、报价工程师、报价审核、工程建 BOM。 */
const DRAWING_VIEWER_PERMISSIONS: readonly string[] = [
  PERMISSION_CODES.SALES_OPERATE,
  PERMISSION_CODES.COSTING_EDIT,
  PERMISSION_CODES.QUOTE_APPROVE,
  PERMISSION_CODES.ENGINEERING_BOM_HANDLE,
]

/**
 * 图纸库版本 → 文件（主用例）。
 *
 * 权限两道：
 * 1. 岗位——不看图的岗位没有理由调这个端点；
 * 2. 客户数据范围——图纸挂在客户名下时，没有 `customer.view-all` 的业务员
 *    只看得到自己负责的客户的图纸，与客户档案那边同一条口径。
 */
@Injectable()
export class DrawingVersionPreviewSource implements FilePreviewSource {
  readonly ownerType: PreviewOwnerType = PREVIEW_OWNER_TYPES.DRAWING_VERSION

  constructor(private readonly prisma: PrismaService) {}

  async resolve(ownerId: string, viewer: PreviewViewer): Promise<ResolvedPreviewFile | null> {
    if (!DRAWING_VIEWER_PERMISSIONS.some((code) => viewer.permissions.includes(code))) {
      return null
    }

    const version = await this.prisma.drawingVersion.findUnique({
      where: { id: ownerId },
      include: { drawing: { select: { drawingNo: true, customerId: true } } },
    })
    if (!version) return null

    const allowed = await this.withinCustomerScope(version.drawing.customerId, viewer)
    if (!allowed) return null

    return {
      objectKey: version.fileKey,
      fileName: version.fileName,
      docType: 'DrawingVersion',
      docId: version.id,
      docLabel: `${version.drawing.drawingNo} ${version.revision}`,
    }
  }

  /** 图纸没挂客户（通用件）时不做范围限制；挂了客户就按客户负责人判。 */
  private async withinCustomerScope(
    customerId: string | null,
    viewer: PreviewViewer,
  ): Promise<boolean> {
    if (!customerId) return true
    if (viewer.permissions.includes(PERMISSION_CODES.CUSTOMER_VIEW_ALL)) return true

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { salesUserCode: true },
    })
    return customer?.salesUserCode === viewer.userCode
  }
}
