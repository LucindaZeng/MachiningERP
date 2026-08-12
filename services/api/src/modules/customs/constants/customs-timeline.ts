import type { CustomsStatus } from '@prisma/client'

/**
 * EXP-01~04 节点名。节点由状态迁移驱动、经平台 timeline 服务落库，耗时由平台算。
 * 「关务复核不可跳过」这条因此是**看得见**的：复核节点没进过，时间线上就是空的。
 */
export const CUSTOMS_TIMELINE_NODES = {
  DRAFT: { node: 'EXP-01 业务建档报关要素', ownerDept: '业务部' },
  CHECKING: { node: 'EXP-02 关务复核要素', ownerDept: '关务岗' },
  GENERATED: { node: 'EXP-03 生成报关资料包', ownerDept: '业务部' },
  DECLARED: { node: 'EXP-04 申报与回执归档', ownerDept: '关务岗' },
} as const satisfies Partial<Record<CustomsStatus, { node: string; ownerDept: string }>>

export type CustomsTimelineStage = keyof typeof CUSTOMS_TIMELINE_NODES

export function customsTimelineNodeFor(
  status: CustomsStatus,
): { node: string; ownerDept: string } | null {
  return CUSTOMS_TIMELINE_NODES[status as CustomsTimelineStage] ?? null
}
