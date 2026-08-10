import type { BizErrorDefinition } from './error-segment'

/**
 * ORD_20xx / 21xx —— 订单管理。
 *
 * 分段与 api-conventions.md 一致：ORD_2xxx 是报价/订单/合同段，其中
 * 报价与成本分析占 ORD_22xx，订单本体用 20xx/21xx。
 */
export const ORDER_ERRORS = {
  ORDER_NOT_FOUND: {
    code: 'ORD_2000',
    status: 404,
    message: '订单不存在',
  },
  /** 正式订单必须关联客户原始订单号（业务规格 4.1「客户订单原件强制上传」） */
  CUSTOMER_PO_REQUIRED: {
    code: 'ORD_2001',
    status: 422,
    message: '该订单类型必须关联客户原始订单号并上传订单原件',
  },
  /** 环环相扣：没有生效报价不能下单（业务规格 4.1） */
  QUOTATION_REQUIRED: {
    code: 'ORD_2002',
    status: 422,
    message: '下单必须关联已生效的报价单',
  },
  ZERO_PRICE: {
    code: 'ORD_2003',
    status: 422,
    message: '正式业务订单价格不能为零',
  },
  FORMAL_MUST_BE_CHARGED: {
    code: 'ORD_2004',
    status: 422,
    message: '正式业务订单强制收费，不允许免费或部分收费',
  },
  /** 下单强制校验：缺报价/成本分析/工程资料时列出全部缺失项 */
  PREREQUISITES_MISSING: {
    code: 'ORD_2005',
    status: 422,
    message: '存在未通过的下单校验项，请补齐后再提交',
  },
  DELIVERY_DATE_REQUIRED: {
    code: 'ORD_2006',
    status: 422,
    message: '客户交期为必填项',
  },
  ORDER_LINES_REQUIRED: {
    code: 'ORD_2007',
    status: 422,
    message: '订单至少要有一行产品明细',
  },
  ORDER_NOT_EDITABLE: {
    code: 'ORD_2008',
    status: 409,
    message: '订单已提交或已被他人修改，请刷新后重试',
  },
  /** 免费/部分收费时三要素必填 */
  FREE_ORDER_FIELDS_REQUIRED: {
    code: 'ORD_2011',
    status: 422,
    message: '免费或部分收费时，费用承担方、预计成本与原因均为必填',
  },
  SALES_ROLE_REQUIRED: {
    code: 'ORD_2012',
    status: 403,
    message: '只有业务岗位可以建立或修改订单',
  },
  APPROVE_ROLE_REQUIRED: {
    code: 'ORD_2013',
    status: 403,
    message: '当前审核节点需要对应岗位权限',
  },
  /** 备料订单无论金额大小都要总经办批准（业务规格 4.5） */
  GM_APPROVAL_REQUIRED: {
    code: 'ORD_2014',
    status: 403,
    message: '备料订单无论金额大小都必须经总经办批准',
  },
  /** 备料库存不足或已被用完 */
  STOCK_PREP_EXHAUSTED: {
    code: 'ORD_2020',
    status: 422,
    message: '备料订单可领用数量不足',
  },
  STOCK_PREP_NOT_READY: {
    code: 'ORD_2021',
    status: 422,
    message: '备料订单尚未完工入库，不能被正式订单领用',
  },
  /** 订单修改申请：价格与下单产品锁定（业务规格 4.6） */
  CHANGE_FIELD_LOCKED: {
    code: 'ORD_2030',
    status: 422,
    message: '订单修改申请只能改数量与交期等订单信息；改价走报价单修改申请，改图改材料走 ECN',
  },
  CHANGE_REQUEST_NOT_FOUND: {
    code: 'ORD_2031',
    status: 404,
    message: '订单修改申请不存在',
  },
  CHANGE_REQUEST_ALREADY_HANDLED: {
    code: 'ORD_2032',
    status: 409,
    message: '该订单修改申请已被处理',
  },
  CHANGE_REJECT_REASON_REQUIRED: {
    code: 'ORD_2033',
    status: 422,
    message: '驳回订单修改申请必须填写理由',
  },
  /** 追踪进度只能由事件推导，不接受手工填报（业务规格 4.7） */
  TRACKING_MANUAL_UPDATE_FORBIDDEN: {
    code: 'ORD_2040',
    status: 403,
    message: '订单追踪进度来自扫码、检验与仓库过账，不允许手工填报',
  },
  ITEM_CODE_INVALID: {
    code: 'ORD_2050',
    status: 422,
    message: '物料品号不符合万富鑫物料编码原则',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type OrderErrorKey = keyof typeof ORDER_ERRORS
