import type { CanonicalNode } from '../../../platform/timeline'
import type { EcnStatus } from '@prisma/client'

/**
 * ECN-01~05 节点名，与前端时间线逐字对齐。
 *
 * 节点由状态迁移驱动、经平台 timeline 服务落库，耗时由平台算——
 * 本模块不自己记时间差，那是节点计时需求（业务规格第 12 章）已经解决过的事。
 */
export const ECN_TIMELINE_NODES: readonly CanonicalNode[] = [
  { node: 'ECN-01 业务提交变更申请', ownerDept: '业务部' },
  { node: 'ECN-02 工程影响评估', ownerDept: '工程部' },
  { node: 'ECN-03 跨部门影响会签', ownerDept: 'PMC / 采购 / 生产 / 品质 / 财务' },
  { node: 'ECN-04 变更批准与版本发布', ownerDept: '工程部 → 总经办' },
  { node: 'ECN-05 执行与批次切换', ownerDept: 'PMC / 生产' },
]

/** 状态 → 进入哪个节点。驳回不进节点：它是在当前节点上结束，不是新的一步。 */
const NODE_BY_STATUS: Partial<Record<EcnStatus, CanonicalNode>> = {
  SUBMITTED: ECN_TIMELINE_NODES[0]!,
  ASSESSING: ECN_TIMELINE_NODES[1]!,
  REVIEWING: ECN_TIMELINE_NODES[2]!,
  APPROVED: ECN_TIMELINE_NODES[3]!,
  EXECUTING: ECN_TIMELINE_NODES[4]!,
}

export function ecnTimelineNodeFor(status: EcnStatus): CanonicalNode | null {
  return NODE_BY_STATUS[status] ?? null
}

export const ECN_DOC_TYPE = 'EcnRequest'
