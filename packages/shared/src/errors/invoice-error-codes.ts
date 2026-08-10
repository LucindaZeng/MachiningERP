import type { BizErrorDefinition } from './error-segment'

/**
 * ORD_27xx —— 发票申请（业务规格第 9 章）。
 *
 * 归在 ORD 段：发票申请由业务发起、服务于订单收款闭环，
 * 财务只负责执行开票；错误要回到业务员的工作台上。
 */
export const INVOICE_ERRORS = {
  NOT_FOUND: {
    code: 'ORD_2700',
    status: 404,
    message: '发票申请不存在',
  },
  NOT_EDITABLE: {
    code: 'ORD_2701',
    status: 409,
    message: '发票申请已被他人修改或已离开可编辑状态，请刷新后重试',
  },
  SALES_ROLE_REQUIRED: {
    code: 'ORD_2702',
    status: 403,
    message: '发票申请需要业务操作权限',
  },
  FINANCE_ROLE_REQUIRED: {
    code: 'ORD_2703',
    status: 403,
    message: '开票、红冲由财务执行，需要财务权限',
  },
  LINES_REQUIRED: {
    code: 'ORD_2704',
    status: 422,
    message: '发票申请至少要有一行明细，且每行必须关联出货单',
  },
  /** 出货 / 对账 / 申请三方金额必须一致，差异先回对账单处理 */
  AMOUNT_MISMATCH: {
    code: 'ORD_2705',
    status: 422,
    message: '开票金额与出货、对账不一致，请先在对账单完成差异处理',
  },
  INVOICE_NO_REQUIRED: {
    code: 'ORD_2706',
    status: 422,
    message: '财务开票必须回填发票号',
  },
  /** 作废（未开票）与红冲（已开票）都必须写明理由 */
  REASON_REQUIRED: {
    code: 'ORD_2707',
    status: 422,
    message: '作废或红冲发票必须写明理由',
  },
  /** 已开票的发票只能红冲，不能作废 */
  VOID_NOT_ALLOWED: {
    code: 'ORD_2708',
    status: 409,
    message: '发票已开出，不能作废；请开具红字发票冲销',
  },
  /** 没开出的申请没有税务凭证，谈不上红冲 */
  CREDIT_NOTE_REQUIRES_ISSUED: {
    code: 'ORD_2709',
    status: 409,
    message: '只有已开票的发票才能红冲',
  },
  /** 累计红冲不得超过原票金额，否则冲出一张负的应收 */
  CREDIT_NOTE_EXCEEDS_ORIGINAL: {
    code: 'ORD_2710',
    status: 422,
    message: '累计红冲金额超过原发票金额',
  },
  /** 寄出、签收各只能发生一次，且签收必须在寄出之后 */
  DELIVERY_OUT_OF_ORDER: {
    code: 'ORD_2711',
    status: 409,
    message: '寄出与签收各只能记录一次，且签收必须在寄出之后',
  },
  NOT_ISSUED_YET: {
    code: 'ORD_2712',
    status: 409,
    message: '发票尚未开出，不能记录寄出或签收',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type InvoiceErrorKey = keyof typeof INVOICE_ERRORS
