/**
 * 预览的归属类型。端点按 `(ownerType, ownerId)` 定位文件，而不是一个通用 file id ——
 * 因为目前系统里根本没有统一的文件表：图纸版本有自己的行，客户订单原件只是订单上
 * 的一个字符串列。硬造一个 file id 等于先发明一张表。
 *
 * 【前瞻·已修正触发条件】原本写的是「等第三种文件出现就迁 `FileObject`」。
 * 报关资料就是第三种，但迁移**再推迟一步**，理由是那条判据挑错了分界线：
 *
 * - **上传类**文件（图纸版本、客户订单原件）需要查重、防覆盖、按扩展名放行——
 *   统一文件表能省掉的正是这些；
 * - **生成类**文件（报关资料，以及即将到来的报价单、成本分析、对账单）天生挂在
 *   自己那张单据行上，resolver 本来就只是一次主键查询，`FileObject` 对它们
 *   一分钱都省不下来，反而多一层间接。
 *
 * 生成类的形态要等 docgen 落地才定得下来。**触发点因此改为「docgen 之后」**，
 * 到时一次迁完，比现在迁一半划算。届时 registry 接口与本端点契约保持不变。
 *
 * 【docgen 落地后的复核结论】生成类的形态已经定了，就是 `GeneratedDocument`
 * 那一行：`(sourceType, sourceId)` 指回来源单据，`objectKey` 指向对象存储，
 * 一次出具一行、写下即不可变。**它本身就是生成侧的统一文件表**，
 * 因此不再另起 `FileObject`——那只会变成一张同义表。
 * 上传侧（图纸、客户订单原件）保持原样：它们要查重、要按扩展名放行，
 * 与生成侧的生命周期本来就不一样，硬并成一张表是把两件事搅在一起。
 * 结论：`FileObject` 迁移**取消**，改为「生成侧统一到 GeneratedDocument，
 * 上传侧维持 (ownerType, ownerId)」，本文件的 registry 契约不变。
 */
export const PREVIEW_OWNER_TYPES = {
  /** 图纸库版本：ownerId = DrawingVersion.id（主用例） */
  DRAWING_VERSION: 'drawing-version',
  /** 客户订单原件：ownerId = SalesOrder.id，文件键取自 customerPoFile */
  ORDER_CUSTOMER_PO: 'order-customer-po',
  /** 报关文件版本：ownerId = CustomsDocument.id（系统生成的第一类文件） */
  CUSTOMS_DOCUMENT: 'customs-document',
  /**
   * docgen 生成物：ownerId = GeneratedDocument.id。
   * 报价单、成本分析、对账单与合并导出都落在这一类；
   * 报关文件不走这里——它有自己的版本链行，两处登记会出现两份真相。
   */
  GENERATED_DOCUMENT: 'generated-document',
} as const

export const PREVIEW_OWNER_TYPE_VALUES = Object.values(PREVIEW_OWNER_TYPES)

export type PreviewOwnerType = (typeof PREVIEW_OWNER_TYPES)[keyof typeof PREVIEW_OWNER_TYPES]

export function isPreviewOwnerType(value: string): value is PreviewOwnerType {
  return (PREVIEW_OWNER_TYPE_VALUES as readonly string[]).includes(value)
}
