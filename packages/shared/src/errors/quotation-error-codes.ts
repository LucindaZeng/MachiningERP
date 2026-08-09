import type { BizErrorDefinition } from './error-segment'

/** ORD_22xx —— 报价与成本分析。 */
export const QUOTATION_ERRORS = {
  COST_ANALYSIS_NOT_FOUND: {
    code: 'ORD_2200',
    status: 404,
    message: '成本分析不存在',
  },
  /** 业务规格 2.2：成本分析只有报价工程师能建/改 */
  COSTING_ROLE_REQUIRED: {
    code: 'ORD_2201',
    status: 403,
    message: '成本分析只有报价工程师可以建立或修改',
  },
  COST_ANALYSIS_LOCKED: {
    code: 'ORD_2202',
    status: 409,
    message: '成本分析已锁版，请通过报价单修改申请生成新版本',
  },
  MATERIAL_PRICE_NOT_FOUND: {
    code: 'ORD_2203',
    status: 422,
    message: '原材料价格表里查不到该材质与形态在报价日期的有效价格',
  },
  /** 损耗率/管理费率/税率可调，但不能是负数、非整数或大得离谱的值 */
  INVALID_COST_RATE: {
    code: 'ORD_2204',
    status: 422,
    message: '成本分析的费率取值不合法',
  },
  QUOTATION_NOT_FOUND: {
    code: 'ORD_2210',
    status: 404,
    message: '报价单不存在',
  },
  /** 硬校验：无成本分析 / 缺图纸不能建单也不能提交 */
  QUOTATION_VALIDATION_FAILED: {
    code: 'ORD_2211',
    status: 422,
    message: '报价单校验未通过',
  },
  /** 低于成本价：拦下并要求修改成本分析 */
  BELOW_COST: {
    code: 'ORD_2212',
    status: 422,
    message: '报价低于成本价，请修改成本分析或调整报价',
  },
  QUOTATION_NOT_EDITABLE: {
    code: 'ORD_2213',
    status: 409,
    message: '报价单已锁版，改价请生成新版本重新审核',
  },
  EXCHANGE_RATE_NOT_FOUND: {
    code: 'ORD_2214',
    status: 422,
    message: '查不到报价日期的当日汇率，请先维护汇率表',
  },
  CHANGE_REQUEST_NOT_FOUND: {
    code: 'ORD_2220',
    status: 404,
    message: '报价单修改申请不存在',
  },
  CHANGE_REQUEST_ALREADY_HANDLED: {
    code: 'ORD_2221',
    status: 409,
    message: '该修改申请已被处理',
  },
  /** 驳回必须填理由，且理由要回到业务员手上 */
  CHANGE_REJECT_REASON_REQUIRED: {
    code: 'ORD_2222',
    status: 422,
    message: '驳回报价单修改申请必须填写理由',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type QuotationErrorKey = keyof typeof QUOTATION_ERRORS
