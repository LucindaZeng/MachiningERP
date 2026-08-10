/**
 * 预览的归属类型。端点按 `(ownerType, ownerId)` 定位文件，而不是一个通用 file id ——
 * 因为目前系统里根本没有统一的文件表：图纸版本有自己的行，客户订单原件只是订单上
 * 的一个字符串列。硬造一个 file id 等于先发明一张表。
 *
 * 【前瞻】等第三种文件出现（质量文件、报关资料、发票扫描件，都在后续模块里），
 * 存储会迁到统一的 `FileObject` 表，届时每个 resolver 塌缩成一次主键查询，
 * **registry 接口与本端点契约保持不变**。现在不要建 FileObject。
 */
export const PREVIEW_OWNER_TYPES = {
  /** 图纸库版本：ownerId = DrawingVersion.id（主用例） */
  DRAWING_VERSION: 'drawing-version',
  /** 客户订单原件：ownerId = SalesOrder.id，文件键取自 customerPoFile */
  ORDER_CUSTOMER_PO: 'order-customer-po',
} as const

export const PREVIEW_OWNER_TYPE_VALUES = Object.values(PREVIEW_OWNER_TYPES)

export type PreviewOwnerType = (typeof PREVIEW_OWNER_TYPES)[keyof typeof PREVIEW_OWNER_TYPES]

export function isPreviewOwnerType(value: string): value is PreviewOwnerType {
  return (PREVIEW_OWNER_TYPE_VALUES as readonly string[]).includes(value)
}
