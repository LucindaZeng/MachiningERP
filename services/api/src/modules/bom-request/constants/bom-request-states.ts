import { StateMachine } from '../../../platform/state-machine'

import type { BomRequestStatus } from '@prisma/client'

/**
 * BOM 申请状态机（ENG-02 提交 → ENG-05 工程回传）。
 *
 * 关键一点：**BOM 可下单与程序可开工是两个独立开关**，界面上必须分开显示，
 * 不得合并成「全部工程完成」。所以状态里有 BOM_DONE 与 ALL_DONE 两级：
 * BOM 建好即可下单，程序还没好不影响业务侧推进。
 *
 * 退回不是终点——工程退回后回到 SUBMITTED 等业务补料，退回等待时长累计留痕。
 */
export const BOM_REQUEST_TRANSITIONS = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['CLAIMED', 'RETURNED', 'DRAFT'],
  /// 程序先编完再签 BOM 是常见顺序，所以 CLAIMED 能直接到 ALL_DONE，
  /// 不强迫必须先经过 BOM_DONE 这一档
  CLAIMED: ['BOM_DONE', 'ALL_DONE', 'RETURNED'],
  /// 退回后业务补料再提交
  RETURNED: ['SUBMITTED'],
  /// BOM 好了就能下单；程序补齐后进 ALL_DONE
  BOM_DONE: ['ALL_DONE', 'ORDERED'],
  ALL_DONE: ['ORDERED'],
  ORDERED: [],
} as const satisfies Record<BomRequestStatus, readonly BomRequestStatus[]>

export const bomRequestStateMachine = new StateMachine<BomRequestStatus>(
  'BOM 申请',
  BOM_REQUEST_TRANSITIONS,
)

/** 只有草稿与被退回的申请可以改内容。 */
export function isBomRequestEditable(status: BomRequestStatus): boolean {
  return status === 'DRAFT' || status === 'RETURNED'
}

/**
 * BOM 已建立即可下单，不必等程序（ENG-05 双状态的业务意义就在这里）。
 *
 * 与 contract-order 的下单前置同口径：后者由 `bom-request.bom-ready`
 * 事件放行，而该事件正是在 BOM 开关合上时发的。
 */
export function canPlaceOrder(status: BomRequestStatus): boolean {
  return status === 'BOM_DONE' || status === 'ALL_DONE' || status === 'ORDERED'
}
