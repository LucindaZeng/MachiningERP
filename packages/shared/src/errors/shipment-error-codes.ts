import type { BizErrorDefinition } from './error-segment'

/**
 * ORD_22xx —— 出货管理（业务规格第 7 章）。
 *
 * 归在 ORD 段而不是 WMS：出货单是业务部的销货单据，拣配入出库由仓储执行，
 * 但放行、信用与尾数处置的责任人是业务，错误也要回到业务员的工作台上。
 */
export const SHIPMENT_ERRORS = {
  NOT_FOUND: {
    code: 'ORD_2500',
    status: 404,
    message: '出货单不存在',
  },
  NOT_EDITABLE: {
    code: 'ORD_2501',
    status: 409,
    message: '出货单已被他人修改或已离开可编辑状态，请刷新后重试',
  },
  SALES_ROLE_REQUIRED: {
    code: 'ORD_2502',
    status: 403,
    message: '出货操作需要业务操作权限',
  },
  /** 一张出货单至少一行，且每行必须挂在订单行上（业务规格第 7 章「各行关联各自订单行」） */
  LINES_REQUIRED: {
    code: 'ORD_2503',
    status: 422,
    message: '出货单至少要有一行明细，且每行必须关联订单行',
  },
  ORDER_LINE_MISMATCH: {
    code: 'ORD_2504',
    status: 422,
    message: '出货明细引用的订单行不属于该订单',
  },
  /** 发货数不能超过订单行未发数量，否则订单回写会算出负的未发量 */
  OVER_SHIPMENT: {
    code: 'ORD_2505',
    status: 422,
    message: '本次发货数量超过订单行的未发数量',
  },
  /** 出货前双闸门：品质放行 + 财务信用，失败时一次列全 */
  RELEASE_BLOCKED: {
    code: 'ORD_2506',
    status: 422,
    message: '出货被阻断：品质放行或财务信用检查未通过',
  },
  /** 尾数四路径之外的值一律拒绝，避免出现无法结案的第五种状态 */
  TAIL_PLAN_INVALID: {
    code: 'ORD_2507',
    status: 422,
    message: '尾数处理方案只能是返工补交 / 入库待后续 / 直接入库 / 报废',
  },
  NO_TAIL_TO_PLAN: {
    code: 'ORD_2508',
    status: 422,
    message: '该出货单没有待处理的尾数',
  },
  /** 结案前的数量平衡校验：订单数 = 已发数 + 已处置尾数 */
  TAIL_NOT_BALANCED: {
    code: 'ORD_2509',
    status: 422,
    message: '仍有尾数未处置，数量不平衡，无法结案',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type ShipmentErrorKey = keyof typeof SHIPMENT_ERRORS

/**
 * ORD_23xx —— 客户对账单（业务规格第 7 章末段）。
 *
 * 对账单的金额一律由源单汇总得出，业务不得手工修改；
 * 因此这里的错误绝大多数都是「你想改的东西不该在这里改」。
 */
export const STATEMENT_ERRORS = {
  NOT_FOUND: {
    code: 'ORD_2600',
    status: 404,
    message: '对账单不存在',
  },
  NOT_EDITABLE: {
    code: 'ORD_2601',
    status: 409,
    message: '对账单已被他人修改，请刷新后重试',
  },
  /** 差异非零必须说明来源，否则差异会在月复一月的对账里沉下去 */
  DIFFERENCE_NOTE_REQUIRED: {
    code: 'ORD_2602',
    status: 422,
    message: '对账差异不为零时必须填写差异说明，并回到源单处理',
  },
  PERIOD_INVALID: {
    code: 'ORD_2603',
    status: 422,
    message: '对账期间不合法：起始日期必须早于或等于截止日期',
  },
  /** 已发出的对账单是给客户签回的凭据，只能重算出新版本，不能就地改 */
  SENT_IS_IMMUTABLE: {
    code: 'ORD_2604',
    status: 409,
    message: '已发出的对账单不可修改，请重新生成新版本',
  },
  LINE_NOT_FOUND: {
    code: 'ORD_2605',
    status: 404,
    message: '对账明细行不存在',
  },
  SALES_ROLE_REQUIRED: {
    code: 'ORD_2606',
    status: 403,
    message: '对账单操作需要业务操作权限',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type StatementErrorKey = keyof typeof STATEMENT_ERRORS
