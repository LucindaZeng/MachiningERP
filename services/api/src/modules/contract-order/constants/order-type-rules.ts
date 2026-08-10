import type { SalesOrderType } from '@prisma/client'

/**
 * 四种订单类型的规则差异（业务规格 4.1~4.5）。
 *
 * 做成**一张声明表**而不是散落在 service 里的 if/else：五种下单动作的差异点
 * 就这几条，写成表以后「样品要不要传 PO」这类问题一眼可查，加第五种类型时
 * 也只需要加一行，不用去翻各处分支。
 */
export interface OrderTypeRule {
  /** 是否需要客户交期。备料订单没有客户交期，改填内部要求完成时间 */
  needsCustomerDeliveryDate: boolean
  /** 是否需要 BOM。样品没有 BOM */
  needsBom: boolean
  /** 是否需要成品品号。样品用样品大类编码，模具用模具编号 */
  needsItemCode: boolean
  /** 是否**无条件**要求客户订单原件。收费样品另有条件规则 */
  alwaysNeedsCustomerPo: boolean
  /** 是否强制收费。正式订单不允许免费或部分收费 */
  mustBeCharged: boolean
  /** 是否需要总经办审批。备料订单无论金额大小都要 */
  needsGmApproval: boolean
  /** 完工入库的目标仓库编号 */
  stockInWarehouse: string
  /** 物料编码大类 */
  itemCategory: string
  label: string
}

export const ORDER_TYPE_RULES = {
  FORMAL: {
    needsCustomerDeliveryDate: true,
    needsBom: true,
    needsItemCode: true,
    alwaysNeedsCustomerPo: true,
    mustBeCharged: true,
    needsGmApproval: false,
    stockInWarehouse: '100',
    itemCategory: '10',
    label: '正常业务订单',
  },
  SAMPLE: {
    needsCustomerDeliveryDate: true,
    // 样品没有 BOM，也没有成品品号（业务规格 4.3）
    needsBom: false,
    needsItemCode: false,
    // 免费样品不要求，收费样品要求——所以不是「无条件」
    alwaysNeedsCustomerPo: false,
    mustBeCharged: false,
    needsGmApproval: false,
    // 样品入样品仓 400
    stockInWarehouse: '400',
    itemCategory: '12',
    label: '样品订单',
  },
  MOLD: {
    // 模具只填要求完成时间，但那仍是一个必填的交期字段
    needsCustomerDeliveryDate: true,
    needsBom: false,
    needsItemCode: true,
    alwaysNeedsCustomerPo: true,
    mustBeCharged: false,
    needsGmApproval: false,
    stockInWarehouse: '301',
    itemCategory: '19',
    label: '模具订单',
  },
  STOCK_PREP: {
    // 备料订单不含交货义务，没有客户交期（业务规格 4.5）
    needsCustomerDeliveryDate: false,
    needsBom: true,
    needsItemCode: true,
    alwaysNeedsCustomerPo: false,
    mustBeCharged: false,
    // 无论金额大小必须经总经办批准
    needsGmApproval: true,
    // 备料完工入成品仓
    stockInWarehouse: '100',
    itemCategory: '10',
    label: '备料订单',
  },
} as const satisfies Record<SalesOrderType, OrderTypeRule>

export function ruleOf(orderType: SalesOrderType): OrderTypeRule {
  return ORDER_TYPE_RULES[orderType]
}

/**
 * 客户订单原件是否必传。
 *
 * 模具、正常业务订单一律要；样品订单**只有收费的**才要，免费样品与备料不要求
 * （业务规格 4.1）。判「收费」看单价而不是 chargeMode——免费样品也可能被误标成
 * CHARGED，但只要价格为零就没有客户订单原件可谈。
 */
export function needsCustomerPo(orderType: SalesOrderType, totalPriceMinor: bigint): boolean {
  if (ruleOf(orderType).alwaysNeedsCustomerPo) return true
  return orderType === 'SAMPLE' && totalPriceMinor > 0n
}
