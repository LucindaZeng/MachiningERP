import type { InvoiceRequestStatus } from '@prisma/client'

/** INV-01~04 节点名，与前端 fixture 的文案逐字一致。 */
export const INVOICE_TIMELINE_NODES = {
  SUBMITTED: { node: 'INV-01 业务提交发票申请', ownerDept: '业务部' },
  REVIEWING: { node: 'INV-02 金额三方一致性校验', ownerDept: '系统' },
  COMPLETED: { node: 'INV-03 财务开票并回写发票号', ownerDept: '财务部' },
} as const satisfies Partial<Record<InvoiceRequestStatus, { node: string; ownerDept: string }>>

/** 交付两步不是状态，只是时间线节点。 */
export const INVOICE_DELIVERY_NODES = {
  SENT: { node: 'INV-04 交付客户并进入应收账龄', ownerDept: '业务部' },
  SIGNED: { node: 'INV-04 客户已签收', ownerDept: '业务部' },
} as const

export function timelineNodeFor(
  status: InvoiceRequestStatus,
): { node: string; ownerDept: string } | null {
  return INVOICE_TIMELINE_NODES[status as keyof typeof INVOICE_TIMELINE_NODES] ?? null
}
