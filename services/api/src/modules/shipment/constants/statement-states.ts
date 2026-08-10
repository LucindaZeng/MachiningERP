import { StateMachine } from '../../../platform/state-machine'

import type { StatementStatus } from '@prisma/client'

/**
 * 对账单状态机（业务规格第 7 章末段）。
 *
 * 争议不是终点：差异回到源单处理后重新发出，所以 DISPUTED → SENT 是允许的。
 * 已确认的对账单也可能因为后补的红字发票再起争议，因此 CONFIRMED → DISPUTED 保留。
 */
export const STATEMENT_TRANSITIONS = {
  DRAFT: ['SENT'],
  SENT: ['CONFIRMED', 'DISPUTED'],
  CONFIRMED: ['SETTLED', 'DISPUTED'],
  /// 差异回源单处理完，重新发一版给客户
  DISPUTED: ['SENT'],
  SETTLED: [],
} as const satisfies Record<StatementStatus, readonly StatementStatus[]>

export const statementStateMachine = new StateMachine<StatementStatus>(
  '客户对账单',
  STATEMENT_TRANSITIONS,
)

/**
 * 已发出的对账单是给客户签回的凭据，不能就地改；
 * 要改只能重算出新版本（version 递增），旧版原样留痕。
 */
export function isStatementMutable(status: StatementStatus): boolean {
  return status === 'DRAFT'
}
