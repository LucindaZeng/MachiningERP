import type { BizErrorDefinition } from './error-segment'

/**
 * ORD_29xx —— 报关资料（业务规格第 10 章）。
 *
 * 归在 ORD 段：报关资料由业务建档、服务于出口订单的交付闭环，
 * 关务岗只负责复核与申报；错误要回到业务员的工作台上。
 */
export const CUSTOMS_ERRORS = {
  NOT_FOUND: {
    code: 'ORD_2900',
    status: 404,
    message: '报关资料不存在',
  },
  NOT_EDITABLE: {
    code: 'ORD_2901',
    status: 409,
    message: '报关资料已被他人修改或已离开可编辑状态，请刷新后重试',
  },
  SALES_ROLE_REQUIRED: {
    code: 'ORD_2902',
    status: 403,
    message: '报关资料建档与生成需要业务操作权限',
  },
  /** 关务复核与申报是独立岗位，业务不能自己复核自己填的要素 */
  CUSTOMS_ROLE_REQUIRED: {
    code: 'ORD_2903',
    status: 403,
    message: '关务复核与申报需要关务操作权限',
  },
  /** 要素齐套是硬闸门：缺项时生成出来的单据到口岸才会被打回 */
  FIELDS_INCOMPLETE: {
    code: 'ORD_2904',
    status: 422,
    message: '报关要素未齐套，禁止生成资料包',
  },
  /** 商业发票与装箱单按实发数开，没发货就没有实发数 */
  SHIPMENT_NOT_POSTED: {
    code: 'ORD_2905',
    status: 409,
    message: '该文件按实发数量开具，出货过账后才能生成',
  },
  DOCUMENT_NOT_FOUND: {
    code: 'ORD_2906',
    status: 404,
    message: '该报关文件尚未生成',
  },
  /** 数据包必须齐：商业发票、装箱单、出口合同缺一不可 */
  DATA_PACK_INCOMPLETE: {
    code: 'ORD_2907',
    status: 422,
    message: '商业发票、装箱单、出口合同齐备后才能生成报关数据包',
  },
  /** 关务复核不可跳过（业务规格第 10 章） */
  REVIEW_REQUIRED: {
    code: 'ORD_2908',
    status: 409,
    message: '报关资料必须经关务复核后才能申报',
  },
  /** 申报即冻结：清单快照是对海关的正式陈述，不允许事后改动 */
  DECLARATION_IMMUTABLE: {
    code: 'ORD_2909',
    status: 409,
    message: '该版申报已提交，清单不可更改；如需更正请新建更正记录',
  },
  /** 更正必须说明——已申报资料的改动要经得起复盘 */
  CORRECTION_REASON_REQUIRED: {
    code: 'ORD_2910',
    status: 422,
    message: '更正已申报的报关资料必须写明理由',
  },
  /** 没申报过就谈不上更正，直接重新生成即可 */
  CORRECTION_REQUIRES_DECLARATION: {
    code: 'ORD_2911',
    status: 409,
    message: '尚未申报的资料无需走更正流程，直接重新生成即可',
  },
  /** 更正必须真的重出了文件，空更正只是一条噪音记录 */
  CORRECTION_LINES_REQUIRED: {
    code: 'ORD_2912',
    status: 422,
    message: '更正记录必须列明重新生成了哪些文件',
  },
  RECEIPT_ALREADY_ARCHIVED: {
    code: 'ORD_2913',
    status: 409,
    message: '该版申报的回执已归档，重复归档会覆盖原始回执号',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type CustomsErrorKey = keyof typeof CUSTOMS_ERRORS
