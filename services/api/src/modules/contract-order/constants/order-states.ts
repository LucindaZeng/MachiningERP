import { StateMachine } from '../../../platform/state-machine'

import { ruleOf } from './order-type-rules'

import type { SalesOrderStatus, SalesOrderType } from '@prisma/client'

/**
 * 订单审核链（业务规格 4.1 + 4.5）。
 *
 * > 订单提交后进入审核流（业务经理 → 财务 → 跨部门订单评审）
 * > 备料订单……业务经理确认必要性，财务审核资金占用，**无论金额大小必须经总经办批准**
 *
 * 所以总经办不是一个独立分支，而是**插在财务与跨部门评审之间的一段**，且只对备料订单出现。
 * 把链写成数组而不是散落的 if：加一道审批只需要往数组里插一项，
 * 状态机的合法迁移表由数组推导，不会出现「链改了但状态机忘了改」。
 */
export const REVIEW_CHAIN: readonly SalesOrderStatus[] = [
  'MANAGER_REVIEW',
  'FINANCE_REVIEW',
  'CROSS_REVIEW',
  'APPROVED',
]

const STOCK_PREP_CHAIN: readonly SalesOrderStatus[] = [
  'MANAGER_REVIEW',
  'FINANCE_REVIEW',
  'GM_REVIEW',
  'CROSS_REVIEW',
  'APPROVED',
]

export function reviewChainOf(orderType: SalesOrderType): readonly SalesOrderStatus[] {
  return ruleOf(orderType).needsGmApproval ? STOCK_PREP_CHAIN : REVIEW_CHAIN
}

/** 当前状态的下一个审核节点；已是 APPROVED 或不在链上时返回 null。 */
export function nextReviewStatus(
  current: SalesOrderStatus,
  orderType: SalesOrderType,
): SalesOrderStatus | null {
  const chain = reviewChainOf(orderType)
  const index = chain.indexOf(current)
  if (index < 0 || index + 1 >= chain.length) return null

  return chain[index + 1] ?? null
}

/** 链上第一个节点，提交时进入。 */
export function firstReviewStatus(orderType: SalesOrderType): SalesOrderStatus {
  return reviewChainOf(orderType)[0] ?? 'MANAGER_REVIEW'
}

export function isReviewStatus(status: SalesOrderStatus, orderType: SalesOrderType): boolean {
  return reviewChainOf(orderType).includes(status) && status !== 'APPROVED'
}

/**
 * 合法迁移表。驳回不是独立状态——任何审核节点都能退回 DRAFT，
 * 理由留在 rejectReason 上，业务员看到的就是一张可以继续改的草稿加一条驳回原因。
 */
function buildTransitions(chain: readonly SalesOrderStatus[]): Record<SalesOrderStatus, readonly SalesOrderStatus[]> {
  const transitions: Record<string, SalesOrderStatus[]> = {
    DRAFT: [chain[0] ?? 'MANAGER_REVIEW', 'VOID'],
    APPROVED: ['EXECUTING', 'CLOSED', 'VOID'],
    EXECUTING: ['COMPLETED', 'CLOSED'],
    COMPLETED: ['CLOSED'],
    CLOSED: [],
    REJECTED: ['DRAFT'],
    VOID: [],
    MANAGER_REVIEW: [],
    FINANCE_REVIEW: [],
    GM_REVIEW: [],
    CROSS_REVIEW: [],
  }

  chain.forEach((status, index) => {
    if (status === 'APPROVED') return
    const next = chain[index + 1]
    transitions[status] = next ? [next, 'DRAFT', 'VOID'] : ['DRAFT', 'VOID']
  })

  return transitions as Record<SalesOrderStatus, readonly SalesOrderStatus[]>
}

export const orderStateMachine = new StateMachine<SalesOrderStatus>(
  '销售订单',
  buildTransitions(REVIEW_CHAIN),
)

export const stockPrepStateMachine = new StateMachine<SalesOrderStatus>(
  '备料订单',
  buildTransitions(STOCK_PREP_CHAIN),
)

export function stateMachineOf(orderType: SalesOrderType): StateMachine<SalesOrderStatus> {
  return ruleOf(orderType).needsGmApproval ? stockPrepStateMachine : orderStateMachine
}

/** 只有草稿态可以改明细；进了审核链就得先驳回或走订单修改申请。 */
export function isOrderEditable(status: SalesOrderStatus): boolean {
  return status === 'DRAFT'
}
