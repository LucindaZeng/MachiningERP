import type { ShipmentStatus } from '@prisma/client'

/**
 * SHP-01~06 节点名（与前端 fixture 的 timeline 文案逐字一致）。
 *
 * 节点由状态迁移驱动、经平台 timeline 服务落库，耗时由平台算，
 * 业务侧不填进度也算不了耗时——这正是「不允许手工填报进度」的落法。
 */
export const SHIPMENT_TIMELINE_NODES = {
  PLANNED: { node: 'SHP-01 生成发货通知', ownerDept: '业务部' },
  PICKING: { node: 'SHP-02 仓库拣配出库', ownerDept: '仓储部' },
  PACKED: { node: 'SHP-03 全检包装完成（T1）', ownerDept: '后工序部' },
  SHIPPED: { node: 'SHP-04 出运发货', ownerDept: '业务部' },
  SIGNED: { node: 'SHP-05 客户签收', ownerDept: '业务部' },
  INVOICED: { node: 'SHP-06 开票与应收', ownerDept: '财务部' },
} as const satisfies Partial<Record<ShipmentStatus, { node: string; ownerDept: string }>>

export type ShipmentTimelineStage = keyof typeof SHIPMENT_TIMELINE_NODES

export function timelineNodeFor(status: ShipmentStatus): { node: string; ownerDept: string } | null {
  return SHIPMENT_TIMELINE_NODES[status as ShipmentTimelineStage] ?? null
}
