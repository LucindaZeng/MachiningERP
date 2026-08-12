import { StateMachine } from '../../../platform/state-machine'

import type { EcnStatus } from '@prisma/client'

/**
 * ECN 状态机（业务规格第 6 章 / ECN-01~05）。
 *
 * 八态与前端 `EcnStatus` 一一对应——界面是设计基线，后端照着它建。
 *
 * 三条有意为之的回头路与终点：
 * - `ASSESSING → SUBMITTED`：工程发现申请本身没说清楚，得能退回业务补充，
 *   而不是硬着头皮评估一份看不懂的变更；
 * - `REVIEWING → ASSESSING`：会签方提出新的影响面，评估要重做；
 * - **`APPROVED` 之后没有回头路**。批准即发布新版本，此后要改只能另开一张 ECN——
 *   与报关「申报即冻结」、发票「开票即完成」是同一条规矩：
 *   已经对外生效的东西不回滚，只追加。
 *
 * `REJECTED` 与 `CLOSED` 都是终态。驳回可以从提交后的任一环节发生，
 * 因为「这个变更不该做」这件事在哪一步都可能被看出来。
 */
export const ECN_TRANSITIONS = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['ASSESSING', 'REJECTED'],
  ASSESSING: ['REVIEWING', 'SUBMITTED', 'REJECTED'],
  REVIEWING: ['APPROVED', 'ASSESSING', 'REJECTED'],
  APPROVED: ['EXECUTING'],
  EXECUTING: ['CLOSED'],
  CLOSED: [],
  REJECTED: [],
} as const satisfies Record<EcnStatus, readonly EcnStatus[]>

export const ecnStateMachine = new StateMachine<EcnStatus>('工程变更申请', ECN_TRANSITIONS)

/** 变更内容还能不能改。送评估之后就不能了——评估是针对某一版内容做的。 */
export function isEcnEditable(status: EcnStatus): boolean {
  return status === 'DRAFT' || status === 'SUBMITTED'
}

/** 是否已批准发布。批准之后关联版本已经推进，任何改动都要另开新单。 */
export function isEcnApproved(status: EcnStatus): boolean {
  return status === 'APPROVED' || status === 'EXECUTING' || status === 'CLOSED'
}

/** 是否已经走到终点（驳回或结案）。 */
export function isEcnFinished(status: EcnStatus): boolean {
  return status === 'CLOSED' || status === 'REJECTED'
}
