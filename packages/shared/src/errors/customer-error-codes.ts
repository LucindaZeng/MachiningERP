import type { BizErrorDefinition } from './error-segment'

/**
 * ORD_21xx —— 客户档案。
 * 归在 ORD 段是因为客户档案是报价/下单链条的第一环，
 * 缺档直接表现为「禁止下单」（api-conventions.md 错误码分段）。
 */
export const CUSTOMER_ERRORS = {
  NOT_FOUND: {
    code: 'ORD_2100',
    status: 404,
    message: '客户不存在或无权访问',
  },
  VALIDATION_FAILED: {
    code: 'ORD_2101',
    status: 422,
    message: '客户档案校验未通过',
  },
  DUPLICATE_NAME: {
    code: 'ORD_2102',
    status: 409,
    message: '同名客户已存在，请勿重复建档',
  },
  CODE_NOT_EDITABLE: {
    code: 'ORD_2103',
    status: 422,
    message: '客户编号由系统生成，不可手工修改',
  },
  /** 下单前的完整性闸门：details 里带缺失项清单 */
  PROFILE_INCOMPLETE: {
    code: 'ORD_2104',
    status: 422,
    message: '客户档案未补全，不能下单',
  },
  SENSITIVE_CHANGE_REQUIRES_APPROVAL: {
    code: 'ORD_2110',
    status: 202,
    message: '敏感字段变更已提交审批，审批通过后才会生效',
  },
  CHANGE_REQUEST_NOT_FOUND: {
    code: 'ORD_2111',
    status: 404,
    message: '变更申请不存在',
  },
  CHANGE_REQUEST_ALREADY_DECIDED: {
    code: 'ORD_2112',
    status: 409,
    message: '该变更申请已被处理，请刷新后重试',
  },
  REJECT_REASON_REQUIRED: {
    code: 'ORD_2113',
    status: 422,
    message: '驳回变更申请必须填写理由',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type CustomerErrorKey = keyof typeof CUSTOMER_ERRORS
