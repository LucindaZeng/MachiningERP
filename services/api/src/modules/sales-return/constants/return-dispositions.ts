import type { ReturnDisposition, ReturnResponsibility } from '@prisma/client'

/**
 * 处置方式与责任归属的字典 + 三张判定表。
 *
 * 业务规格第 8 章把「处理路径」写成一串：退货、返修、补货、让步使用、客户8D。
 * 那串话把**三个正交的轴**混在了一起，前端的模型已经正确地把它们拆开了，
 * 这里照前端来：
 *
 * 1. `ReturnDisposition` —— 「这笔客诉我们怎么处理」（钱与货的结论）；
 * 2. 客户 8D —— 并行的品质流程轨道（`SalesReturn.eightDNo`），可伴随任意处置；
 * 3. 物理退货入库 —— 仓储事实（`SalesReturnLine.receivedAt`），
 *    与「谁掏钱」无关，但返工必须先把不良品收回来才能开工。
 *
 * 规格用词 → 本枚举：退货 = REFUND，补货 = REPLACEMENT，返修 = REWORK，
 * 让步使用 = CONCESSION。SCRAP 与 UNDECIDED 是前端既有的补充值，
 * UNDECIDED 是登记时的初始态，结案闸门要求它被解决掉。
 */

/** 前端 DISPOSITION 字典的枚举 ↔ 线上值。 */
export const DISPOSITION_TO_WIRE = {
  REFUND: 'refund',
  REPLACEMENT: 'replacement',
  REWORK: 'rework',
  CONCESSION: 'concession',
  SCRAP: 'scrap',
  UNDECIDED: 'undecided',
} as const satisfies Record<ReturnDisposition, string>

export type DispositionWire = (typeof DISPOSITION_TO_WIRE)[ReturnDisposition]

export const DISPOSITION_BY_WIRE = Object.fromEntries(
  Object.entries(DISPOSITION_TO_WIRE).map(([enumValue, wire]) => [wire, enumValue]),
) as Record<DispositionWire, ReturnDisposition>

export const RESPONSIBILITY_TO_WIRE = {
  COMPANY: 'company',
  CUSTOMER: 'customer',
  SUPPLIER: 'supplier',
  UNDECIDED: 'undecided',
} as const satisfies Record<ReturnResponsibility, string>

export type ResponsibilityWire = (typeof RESPONSIBILITY_TO_WIRE)[ReturnResponsibility]

export const RESPONSIBILITY_BY_WIRE = Object.fromEntries(
  Object.entries(RESPONSIBILITY_TO_WIRE).map(([enumValue, wire]) => [wire, enumValue]),
) as Record<ResponsibilityWire, ReturnResponsibility>

export function isDispositionWire(value: string): value is DispositionWire {
  return value in DISPOSITION_BY_WIRE
}

export function isResponsibilityWire(value: string): value is ResponsibilityWire {
  return value in RESPONSIBILITY_BY_WIRE
}

/**
 * 判定表一：这个处置对客户对账单有什么影响，以及算哪一类。
 *
 * | 处置 | 对账单 | 类型 | 为什么 |
 * | --- | --- | --- | --- |
 * | REFUND | 扣减 | RETURN | 货退回来了，钱要退 |
 * | SCRAP | 扣减 | RETURN | 不良品直接报废，同样得给客户抵掉这笔货值，否则客诉没解决 |
 * | CONCESSION | 扣减**减价额** | ALLOWANCE | 客户留用，只减价——不是退货，对账单上不能写成「退货」 |
 * | REWORK | 无 | — | 修好还回去，货值原样，钱不动 |
 * | REPLACEMENT | 无 | — | 「补发不另收费」，补的那一票也不许再计入发货列 |
 * | UNDECIDED | 无 | — | 没定的事不进账 |
 */
/** 对账明细行里只有这两类是退货侧的减项；其余类型与 RMA 无关。 */
export type ReturnStatementLineType = 'RETURN' | 'ALLOWANCE'

export const STATEMENT_EFFECT: Record<ReturnDisposition, ReturnStatementLineType | null> = {
  REFUND: 'RETURN',
  SCRAP: 'RETURN',
  CONCESSION: 'ALLOWANCE',
  REWORK: null,
  REPLACEMENT: null,
  UNDECIDED: null,
}

export function statementLineTypeOf(disposition: ReturnDisposition): ReturnStatementLineType | null {
  return STATEMENT_EFFECT[disposition]
}

/**
 * 判定表二：这个处置要不要财务 / 总经办审批。
 *
 * 控制矩阵：「客户投诉和 RMA 由业务登记、品质判定与调查，
 * 涉及退款、补货、召回或高额索赔时由财务和总经办审批。」
 * 让步接收同样在例外升级清单里，因此一并纳入。
 */
export const NEEDS_FINANCE_APPROVAL: Record<ReturnDisposition, boolean> = {
  REFUND: true,
  REPLACEMENT: true,
  CONCESSION: true,
  SCRAP: false,
  REWORK: false,
  UNDECIDED: false,
}

/**
 * 判定表三：这个处置动不动钱——动钱就必须写理由。
 * 报废虽不需财务审批（金额分级由审批链另管），但同样是笔扣减，理由一样要写。
 */
export const REQUIRES_REASON: Record<ReturnDisposition, boolean> = {
  REFUND: true,
  CONCESSION: true,
  SCRAP: true,
  REPLACEMENT: false,
  REWORK: false,
  UNDECIDED: false,
}

/**
 * 返工必须先收到不良品。这条顺序卡在状态机上而不是写进枚举：
 * 「货回来了没有」是仓储事实，与「怎么处理」是两个轴。
 */
export function requiresGoodsReceipt(disposition: ReturnDisposition): boolean {
  return disposition === 'REWORK'
}

/** 单头展示用的「按行不一」标记。存派生值会腐坏，因此只在映射时现算。 */
export const MIXED_MARKER = 'undecided'
