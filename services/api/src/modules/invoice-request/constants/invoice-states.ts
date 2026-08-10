import { StateMachine } from '../../../platform/state-machine'

import type { InvoiceRequestStatus } from '@prisma/client'

/**
 * 发票申请状态机（业务规格第 9 章）。
 *
 * 走**共享 DocStatus 的词汇**，不另造一套：
 * SUBMITTED=待复核，REVIEWING=财务开票中，COMPLETED=已开票交付。
 *
 * 关键决定：**COMPLETED 在开票那一刻就到**，不等寄出、不等签收。
 * 状态不能倒退，而寄出与签收既不阻断任何下游，也不改变应收——
 * 它们是 COMPLETED 之后的两个时间戳事件，只推进时间线（INV-03 / INV-04）。
 */
export const INVOICE_TRANSITIONS = {
  DRAFT: ['SUBMITTED', 'VOID'],
  /// 待复核：可送财务、可驳回、可作废（还没开票，作废无税务影响）
  SUBMITTED: ['REVIEWING', 'REJECTED', 'VOID'],
  /// 财务开票中：开出即 COMPLETED
  REVIEWING: ['COMPLETED', 'REJECTED', 'VOID'],
  /// 已开票：税务凭证已存在，只能红冲，不能回退也不能作废
  COMPLETED: [],
  REJECTED: ['DRAFT'],
  VOID: [],
} as const satisfies Record<InvoiceRequestStatus, readonly InvoiceRequestStatus[]>

export const invoiceStateMachine = new StateMachine<InvoiceRequestStatus>(
  '发票申请',
  INVOICE_TRANSITIONS,
)

/** 只有还没送出去的申请可以改内容。 */
export function isInvoiceEditable(status: InvoiceRequestStatus): boolean {
  return status === 'DRAFT' || status === 'REJECTED'
}

/** 已开票：税务凭证已存在。作废与红冲的分界线就在这里。 */
export function isIssued(status: InvoiceRequestStatus): boolean {
  return status === 'COMPLETED'
}

/** 未开票前才谈得上作废。 */
export function isVoidable(status: InvoiceRequestStatus): boolean {
  return status === 'DRAFT' || status === 'SUBMITTED' || status === 'REVIEWING'
}
