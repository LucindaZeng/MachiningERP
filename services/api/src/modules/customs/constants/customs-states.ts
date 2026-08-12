import { StateMachine } from '../../../platform/state-machine'

import type { CustomsStatus } from '@prisma/client'

/**
 * 报关资料状态机（业务规格第 10 章 / EXP-01~04）。
 *
 * 五态与前端 `CustomsStatus` 一一对应——界面是设计基线，后端照着它建。
 *
 * 两处闸门：
 * - `CHECKING → GENERATED`：要素齐套才允许出整包（见 customs-completeness.ts）；
 * - `GENERATED → DECLARED`：**申报是不可变边界**，此刻冻结清单快照。
 *
 * `GENERATED → CHECKING` 这条回头路是有意留的：关务复核发现要素填错，
 * 得能退回去改，而不是把一包错资料申报出去再更正。申报之后就没有回头路了。
 */
export const CUSTOMS_TRANSITIONS = {
  DRAFT: ['CHECKING'],
  CHECKING: ['GENERATED', 'DRAFT'],
  GENERATED: ['DECLARED', 'CHECKING'],
  DECLARED: ['RELEASED'],
  RELEASED: [],
} as const satisfies Record<CustomsStatus, readonly CustomsStatus[]>

export const customsStateMachine = new StateMachine<CustomsStatus>('报关资料', CUSTOMS_TRANSITIONS)

/** 贸易要素还能不能改。申报之后一律不能——那是对海关的正式陈述。 */
export function isDossierEditable(status: CustomsStatus): boolean {
  return status === 'DRAFT' || status === 'CHECKING'
}

/**
 * 是否已经申报。这是本模块最重要的一条判断：
 * 申报之前重新生成文件是日常迭代，申报之后必须走更正记录并填理由。
 */
export function isDeclared(status: CustomsStatus): boolean {
  return status === 'DECLARED' || status === 'RELEASED'
}
