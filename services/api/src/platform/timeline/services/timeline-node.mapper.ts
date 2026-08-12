import type { TimelineNodeRecord } from '../repositories/doc-timeline.repository.port'

const MS_PER_HOUR = 3_600_000

/**
 * 节点计时的对外形状，对齐前端 `TimelineNode`。
 * 耗时由平台算好，这里只做单位换算（毫秒 → 小时）。
 */
export interface DocTimelineNodeView {
  node: string
  owner: string
  state: 'done' | 'active' | 'pending' | 'overdue'
  enteredAt?: string
  finishedAt?: string
  elapsedHours?: number
  remark?: string
}

/** 一条流程的固定节点序列：`[{ node, ownerDept }]`，由各模块的 constants 提供。 */
export interface CanonicalNode {
  node: string
  ownerDept: string
}

function stateOf(record: TimelineNodeRecord): DocTimelineNodeView['state'] {
  if (record.status === 'ABNORMAL') return 'overdue'
  if (record.leftAt === null) return 'active'
  return 'done'
}

function toNodeView(record: TimelineNodeRecord, fallbackOwner: string): DocTimelineNodeView {
  const view: DocTimelineNodeView = {
    node: record.node,
    owner: record.ownerDept ?? record.ownerUserCode ?? fallbackOwner,
    state: stateOf(record),
  }
  view.enteredAt = record.enteredAt.toISOString()
  if (record.leftAt) view.finishedAt = record.leftAt.toISOString()
  if (record.durationMs !== null) {
    view.elapsedHours = Math.round((Number(record.durationMs) / MS_PER_HOUR) * 100) / 100
  }
  if (record.remark) view.remark = record.remark
  return view
}

/**
 * 把落库的节点记录铺成前端要的那一排格子。
 *
 * 提到平台层的理由：出货、销退、报关三个模块曾各抄了一份**逐字相同**的实现，
 * 差别只在那份固定节点清单。差异既然只有数据，就该由参数传，不该由复制表达。
 *
 * 两条口径在这里统一：
 * 1. 没有记录的节点补成 `pending`——界面永远是完整的一排，缺哪一步一眼看得出；
 * 2. 耗时一律取平台算好的 `durationMs`，调用方不自己减时间戳。
 *    两处各算一次，迟早会算出两个答案。
 */
export function toTimelineNodeViews(
  records: readonly TimelineNodeRecord[],
  canonical: readonly CanonicalNode[],
  fallbackOwner: string,
): DocTimelineNodeView[] {
  const byNode = new Map(records.map((record) => [record.node, record]))

  return canonical.map((item) => {
    const record = byNode.get(item.node)
    if (record) return toNodeView(record, fallbackOwner)
    return { node: item.node, owner: item.ownerDept, state: 'pending' as const }
  })
}
