import type { BizErrorDefinition } from './error-segment'

/**
 * ORD_28xx —— 销退 / RMA（业务规格第 8 章）。
 *
 * 归在 ORD 段：客诉与退货由业务登记、业务跟踪、业务回复客户；
 * 品质判定与生产返工是被动接手方，错误要回到业务员的工作台上。
 */
export const SALES_RETURN_ERRORS = {
  NOT_FOUND: {
    code: 'ORD_2800',
    status: 404,
    message: '退货单不存在',
  },
  NOT_EDITABLE: {
    code: 'ORD_2801',
    status: 409,
    message: '退货单已被他人修改或已离开可编辑状态，请刷新后重试',
  },
  SALES_ROLE_REQUIRED: {
    code: 'ORD_2802',
    status: 403,
    message: '退货单登记与结案需要业务操作权限',
  },
  /** 责任归属是品质部的判定结论，业务不能自己填 */
  QUALITY_ROLE_REQUIRED: {
    code: 'ORD_2803',
    status: 403,
    message: '责任归属由品质部判定，需要品质操作权限',
  },
  /** 退款、让步、补货按控制矩阵升级到财务与总经办 */
  FINANCE_ROLE_REQUIRED: {
    code: 'ORD_2804',
    status: 403,
    message: '涉及退款 / 让步 / 补货的处置需要财务审批权限',
  },
  LINES_REQUIRED: {
    code: 'ORD_2805',
    status: 422,
    message: '退货单至少要有一行明细，且每行必须关联原出货行',
  },
  /** 退货数量不能超过该出货行实发数量 */
  QTY_EXCEEDS_SHIPPED: {
    code: 'ORD_2806',
    status: 422,
    message: '退货数量超过该行的实际发货数量',
  },
  /** 结案闸门：每一行都要有责任归属与处置方式 */
  LINE_DISPOSITION_REQUIRED: {
    code: 'ORD_2807',
    status: 422,
    message: '结案前每一行都必须有明确的责任归属与处置方式',
  },
  /** 退款 / 让步 / 报废动钱，理由必填且要能追溯 */
  DISPOSITION_REASON_REQUIRED: {
    code: 'ORD_2808',
    status: 422,
    message: '退款、让步、报废的处置必须写明理由',
  },
  /** 让步接收的折让金额是与客户谈定的减价，不能由系统推算 */
  ALLOWANCE_AMOUNT_REQUIRED: {
    code: 'ORD_2809',
    status: 422,
    message: '让步接收必须录入与客户谈定的折让金额',
  },
  /** 让步折让不能超过该行货值，否则会冲出一笔负应收 */
  ALLOWANCE_EXCEEDS_LINE: {
    code: 'ORD_2810',
    status: 422,
    message: '让步折让金额不能超过该行货值',
  },
  /** 返工要先把不良品收回来才能开工，顺序卡在状态机上 */
  GOODS_NOT_RECEIVED: {
    code: 'ORD_2811',
    status: 409,
    message: '返工处置必须先登记退货入库，收到不良品后才能开始执行',
  },
  RECEIPT_ALREADY_RECORDED: {
    code: 'ORD_2812',
    status: 409,
    message: '该行的退货入库已登记过，重复登记会重复计入不良仓',
  },
  /** 结案即锁定金额，之后要改只能开新单据（与已发出对账单的不可变一致） */
  CLOSED_IS_IMMUTABLE: {
    code: 'ORD_2813',
    status: 409,
    message: '退货单已结案，金额与处置不可再修改；如需更正请另开单据',
  },
  /** 不成立（rejected）必须说明，否则客诉记录无从复盘 */
  REJECT_REASON_REQUIRED: {
    code: 'ORD_2814',
    status: 422,
    message: '判定客诉不成立必须写明理由',
  },
  LINE_NOT_FOUND: {
    code: 'ORD_2815',
    status: 404,
    message: '退货明细行不存在',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type SalesReturnErrorKey = keyof typeof SALES_RETURN_ERRORS
