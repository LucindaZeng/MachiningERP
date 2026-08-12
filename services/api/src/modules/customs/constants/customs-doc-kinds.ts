import type { CustomsDocKind } from '@prisma/client'

/**
 * 五种报关文件（业务规格第 10 章）。
 *
 * **为什么是五种而不是前端 fixture 里的四种**：fixture 有一个格子的中文写「形式发票」、
 * 英文写「Commercial Invoice」，自相矛盾，那是 fixture 的错而不是设计。
 * 两者是不同单据：
 *
 * - **形式发票 Proforma Invoice**：出货**前**按订单数据开，用途是开信用证、收预付款。
 *   数量还可能变，它照样成立——它是一份报价性质的承诺，不是结算凭证。
 * - **商业发票 Commercial Invoice**：出货**后**按实发数量与重量开，海关据以清关。
 *
 * 因此报关数据包引用的永远是商业发票；形式发票按需出（预付/信用证客户）。
 */
export const CUSTOMS_DOC_KINDS = {
  PROFORMA_INVOICE: 'PROFORMA_INVOICE',
  COMMERCIAL_INVOICE: 'COMMERCIAL_INVOICE',
  PACKING_LIST: 'PACKING_LIST',
  CONTRACT: 'CONTRACT',
  DATA_PACK: 'DATA_PACK',
} as const satisfies Record<CustomsDocKind, CustomsDocKind>

export const CUSTOMS_DOC_KIND_VALUES = Object.values(CUSTOMS_DOC_KINDS)

/** 前端模板编码（fixture 的 templateCode）↔ 枚举。 */
export const DOC_KIND_TO_TEMPLATE = {
  PROFORMA_INVOICE: 'EXP-PIN',
  COMMERCIAL_INVOICE: 'EXP-INV',
  PACKING_LIST: 'EXP-PKL',
  CONTRACT: 'EXP-CON',
  DATA_PACK: 'EXP-DEC',
} as const satisfies Record<CustomsDocKind, string>

export type CustomsTemplateCode = (typeof DOC_KIND_TO_TEMPLATE)[CustomsDocKind]

export const DOC_KIND_BY_TEMPLATE = Object.fromEntries(
  Object.entries(DOC_KIND_TO_TEMPLATE).map(([kind, template]) => [template, kind]),
) as Record<CustomsTemplateCode, CustomsDocKind>

export function isCustomsTemplateCode(value: string): value is CustomsTemplateCode {
  return value in DOC_KIND_BY_TEMPLATE
}

/** 前端展示名（中英对照，与 fixture 的 name 同款写法）。 */
export const DOC_KIND_LABEL = {
  PROFORMA_INVOICE: '形式发票 Proforma Invoice',
  COMMERCIAL_INVOICE: '商业发票 Commercial Invoice',
  PACKING_LIST: '装箱单 Packing List',
  CONTRACT: '出口合同 Sales Contract',
  DATA_PACK: '报关单要素表',
} as const satisfies Record<CustomsDocKind, string>

/**
 * 数据包必须包含的文件。形式发票**不在其中**：它是按需出具的收款工具，
 * 不是清关材料。把它设成必需，等于逼着每一票非预付订单去开一张用不上的单据。
 */
export const REQUIRED_FOR_DATA_PACK: readonly CustomsDocKind[] = [
  'COMMERCIAL_INVOICE',
  'PACKING_LIST',
  'CONTRACT',
]

/**
 * 出具前必须已经实际发货的文件种类。
 *
 * 商业发票、装箱单按**实发**数量与重量开——没发货就没有实发数，
 * 硬生成一份只能填订单数，而那正是清关时对不上箱单的经典事故。
 * 形式发票与合同不受此限，它们本来就活在发货之前。
 */
export function requiresPostedShipment(kind: CustomsDocKind): boolean {
  return kind === 'COMMERCIAL_INVOICE' || kind === 'PACKING_LIST' || kind === 'DATA_PACK'
}
