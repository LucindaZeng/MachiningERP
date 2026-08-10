import type { SalesReturnStatus } from '@prisma/client'

/**
 * RMA-01~05 节点名（与前端 fixture 的 timeline 文案逐字一致）。
 *
 * 节点由状态迁移驱动、经平台 timeline 服务落库，耗时由平台算。
 * 首响 SLA（fixture 里「2 小时首响 SLA 内完成」）因此是算出来的，不是填出来的。
 */
export const RETURN_TIMELINE_NODES = {
  REGISTERED: { node: 'RMA-01 业务登记客诉', ownerDept: '业务部' },
  QUALITY_JUDGING: { node: 'RMA-02 品质判定与责任归属', ownerDept: '品质部' },
  DISPOSITION: { node: 'RMA-03 处置方案审批', ownerDept: '业务经理' },
  EXECUTING: { node: 'RMA-04 退货入库与执行', ownerDept: '仓储部 / 生产部' },
  CLOSED: { node: 'RMA-05 结案与 8D 关闭', ownerDept: '品质部 / 业务' },
} as const satisfies Partial<Record<SalesReturnStatus, { node: string; ownerDept: string }>>

export type ReturnTimelineStage = keyof typeof RETURN_TIMELINE_NODES

export function returnTimelineNodeFor(
  status: SalesReturnStatus,
): { node: string; ownerDept: string } | null {
  return RETURN_TIMELINE_NODES[status as ReturnTimelineStage] ?? null
}
