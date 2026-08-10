import type { BizErrorDefinition } from './error-segment'

/**
 * ORD_21xx —— BOM 申请。
 *
 * 归在 ORD 段是因为 BOM 申请由业务发起、服务于下单闭环（业务规格第 5 章），
 * 而不是工程部自己的内部单据；错误也要回到业务员的工作台上。
 */
export const BOM_ERRORS = {
  NOT_FOUND: {
    code: 'ORD_2400',
    status: 404,
    message: 'BOM 申请不存在',
  },
  /** 样品既不建 BOM 也不建品号（业务规格 4.3、第 5 章） */
  SAMPLE_NEEDS_NO_BOM: {
    code: 'ORD_2401',
    status: 422,
    message: '样品订单不建 BOM，也不建品号，不需要提 BOM 申请',
  },
  /** 直接引用报价单内的产品，图纸不重复上传 */
  QUOTATION_REQUIRED: {
    code: 'ORD_2402',
    status: 422,
    message: 'BOM 申请必须引用报价单内的产品，图纸沿用报价环节上传的版本',
  },
  DRAWING_VERSION_REQUIRED: {
    code: 'ORD_2403',
    status: 422,
    message: '引用的报价产品没有图纸版本，无法转给工程建立 BOM',
  },
  NOT_EDITABLE: {
    code: 'ORD_2404',
    status: 409,
    message: 'BOM 申请已提交或已被他人修改，请刷新后重试',
  },
  SALES_ROLE_REQUIRED: {
    code: 'ORD_2405',
    status: 403,
    message: '只有业务岗位可以提交 BOM 申请',
  },
  ENGINEERING_ROLE_REQUIRED: {
    code: 'ORD_2406',
    status: 403,
    message: '接收、退回与回传 BOM 结果需要工程部权限',
  },
  /** 退回必须说明缺什么，否则业务员不知道要补什么 */
  RETURN_REASON_REQUIRED: {
    code: 'ORD_2407',
    status: 422,
    message: '退回 BOM 申请必须写明需要补充的资料',
  },
  /** 工程建立的编码：量产是品号，模具是模具编号 */
  PRODUCT_CODE_REQUIRED: {
    code: 'ORD_2408',
    status: 422,
    message: 'BOM 建立完成必须回填品号（模具申请回填模具编号）',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type BomErrorKey = keyof typeof BOM_ERRORS
