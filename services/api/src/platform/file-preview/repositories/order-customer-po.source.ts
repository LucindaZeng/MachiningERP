import { PERMISSION_CODES } from '@machining-erp/shared'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'
import { PREVIEW_OWNER_TYPES, type PreviewOwnerType } from '../constants/preview-owner-types'

import type {
  FilePreviewSource,
  PreviewViewer,
  ResolvedPreviewFile,
} from './file-preview-source.port'

/** 会因职责需要看客户订单原件的岗位：业务与订单审核链上的三个节点。 */
const ORDER_VIEWER_PERMISSIONS: readonly string[] = [
  PERMISSION_CODES.SALES_OPERATE,
  PERMISSION_CODES.ORDER_APPROVE,
  PERMISSION_CODES.ORDER_FINANCE_REVIEW,
  PERMISSION_CODES.ORDER_CROSS_REVIEW,
]

/**
 * 客户订单原件 → 文件。
 *
 * `SalesOrder.customerPoFile` 只是一个对象键字符串，没有独立的文件行，
 * 因此文件名从键的 basename 推出来。等统一文件表落地后，这个 resolver
 * 会塌缩成一次主键查询，端点契约不变。
 */
@Injectable()
export class OrderCustomerPoPreviewSource implements FilePreviewSource {
  readonly ownerType: PreviewOwnerType = PREVIEW_OWNER_TYPES.ORDER_CUSTOMER_PO

  constructor(private readonly prisma: PrismaService) {}

  async resolve(ownerId: string, viewer: PreviewViewer): Promise<ResolvedPreviewFile | null> {
    if (!ORDER_VIEWER_PERMISSIONS.some((code) => viewer.permissions.includes(code))) {
      return null
    }

    const order = await this.prisma.salesOrder.findUnique({
      where: { id: ownerId },
      select: { id: true, docNo: true, customerId: true, customerPoFile: true },
    })
    if (!order?.customerPoFile) return null

    const allowed = await this.withinCustomerScope(order.customerId, viewer)
    if (!allowed) return null

    return {
      objectKey: order.customerPoFile,
      fileName: baseNameOf(order.customerPoFile),
      docType: 'SalesOrder',
      docId: order.id,
      docLabel: order.docNo,
    }
  }

  private async withinCustomerScope(customerId: string, viewer: PreviewViewer): Promise<boolean> {
    if (viewer.permissions.includes(PERMISSION_CODES.CUSTOMER_VIEW_ALL)) return true

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { salesUserCode: true },
    })
    return customer?.salesUserCode === viewer.userCode
  }
}

/** 对象键的最后一段就是文件名；键本身可能带目录前缀。 */
export function baseNameOf(objectKey: string): string {
  const segments = objectKey.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? objectKey
}
