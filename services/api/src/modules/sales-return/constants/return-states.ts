import { StateMachine } from '../../../platform/state-machine'

import type { SalesReturnStatus } from '@prisma/client'

/**
 * 销退 / RMA 状态机（业务规格第 8 章 / RMA-01~05）。
 *
 * 六态与前端 `ReturnStatus` 一一对应——界面是设计基线，后端照着它建。
 *
 * 两处「闸门」：
 * - `DISPOSITION → EXECUTING`：每一行都要有责任归属与处置方式（见 collectClosureIssues）；
 * - `EXECUTING → CLOSED`：结案闸门再校一次，并就此**锁死金额**。
 *
 * `REJECTED`（客诉不成立）可以从判定或审批阶段进入，是终点：
 * 不成立就不该再生出扣减；客户若不服，走新客诉，不是把旧单捞回来改。
 */
export const SALES_RETURN_TRANSITIONS = {
  REGISTERED: ['QUALITY_JUDGING', 'REJECTED'],
  QUALITY_JUDGING: ['DISPOSITION', 'REJECTED'],
  DISPOSITION: ['EXECUTING', 'REJECTED'],
  EXECUTING: ['CLOSED'],
  CLOSED: [],
  REJECTED: [],
} as const satisfies Record<SalesReturnStatus, readonly SalesReturnStatus[]>

export const salesReturnStateMachine = new StateMachine<SalesReturnStatus>(
  '退货单',
  SALES_RETURN_TRANSITIONS,
)

/**
 * 明细行（数量、金额、处置）还能不能改。
 *
 * 结案与不成立之后一律不可改：结案已把金额送进对账单，不成立则根本不该有金额。
 * 执行中仍可改的只有执行类字段（入库登记），金额类改动由 assertAmountsMutable 单独把守。
 */
export function isReturnEditable(status: SalesReturnStatus): boolean {
  return status === 'REGISTERED' || status === 'QUALITY_JUDGING' || status === 'DISPOSITION'
}

/** 已结案：对账单已计入，金额与处置就此不可变。 */
export function isReturnClosed(status: SalesReturnStatus): boolean {
  return status === 'CLOSED'
}

/** 终态：既不能再推进，也不能再改。 */
export function isReturnTerminal(status: SalesReturnStatus): boolean {
  return status === 'CLOSED' || status === 'REJECTED'
}
