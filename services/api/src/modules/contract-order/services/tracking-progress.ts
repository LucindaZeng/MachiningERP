import { parseDecimal } from '@machining-erp/shared'
import Decimal from 'decimal.js'

import type { TrackNodeStatus } from '@prisma/client'

export interface TrackingNodeFacts {
  sequence: number
  node: string
  phase: string
  department: string
  status: TrackNodeStatus
  qtyIn: string | null
  qtyOk: string | null
  qtyNg: string | null
  startedAt: Date | null
  finishedAt: Date | null
}

/**
 * 单个节点的进度。**只有完成数与总数两个数字，没有百分比字段**——
 * 业务规格 4.7 明确要求「显示为完成数/工单数（如 58/100），不使用百分比」。
 * 契约里根本不提供百分比，前端就没法「顺手」渲染成 58%。
 */
export interface NodeProgress {
  sequence: number
  node: string
  phase: string
  department: string
  status: TrackNodeStatus
  /** 完成数 */
  done: string
  /** 工单数 */
  total: string
  ngQty: string
  startedAt: Date | null
  finishedAt: Date | null
  /** 停留时长（小时），未开始为 null */
  dwellHours: number | null
}

export interface OrderLineProgress {
  /** 当前所处节点名称；全部完成时为最后一个节点 */
  currentNode: string | null
  /** 已完成节点数 / 总节点数——同样是两个计数，不是比例 */
  doneNodes: number
  totalNodes: number
  /** 是否存在异常节点（检验不合格、停滞），供预警中心联动 */
  hasBlocked: boolean
  nodes: NodeProgress[]
}

/**
 * 节点进度聚合。
 *
 * 数量口径按状态取：
 * - `PENDING` 未开始 → 完成数 0；
 * - `DONE` 已完成 → 完成数取合格数，没记合格数就按投入数（老数据兜底）；
 * - `ACTIVE`/`BLOCKED` 进行中 → 完成数取已合格数，没有就是 0。
 *
 * **绝不按状态猜一个百分比再乘总数**。进行中而尚未报合格数时就是 0/100，
 * 这是真话；写成「进行中≈50%」会让业务以为已经做了一半。
 */
export function toNodeProgress(node: TrackingNodeFacts, orderQty: string): NodeProgress {
  const total = node.qtyIn ?? orderQty
  const ok = node.qtyOk
  const done = node.status === 'PENDING' ? '0' : (ok ?? (node.status === 'DONE' ? total : '0'))

  return {
    sequence: node.sequence,
    node: node.node,
    phase: node.phase,
    department: node.department,
    status: node.status,
    done: normalize(done),
    total: normalize(total),
    ngQty: normalize(node.qtyNg ?? '0'),
    startedAt: node.startedAt,
    finishedAt: node.finishedAt,
    dwellHours: dwellHoursOf(node),
  }
}

export function aggregateLineProgress(
  nodes: readonly TrackingNodeFacts[],
  orderQty: string,
): OrderLineProgress {
  const ordered = [...nodes].sort((left, right) => left.sequence - right.sequence)
  const progress = ordered.map((node) => toNodeProgress(node, orderQty))

  const active = ordered.find((node) => node.status === 'ACTIVE' || node.status === 'BLOCKED')
  const lastDone = [...ordered].reverse().find((node) => node.status === 'DONE')

  return {
    currentNode: active?.node ?? lastDone?.node ?? ordered[0]?.node ?? null,
    doneNodes: ordered.filter((node) => node.status === 'DONE').length,
    totalNodes: ordered.length,
    hasBlocked: ordered.some((node) => node.status === 'BLOCKED'),
    nodes: progress,
  }
}

/**
 * 订单头的汇总状态：一单多产品时按产品行分别追踪，头上显示各行汇总
 * （业务规格 4.7）。取「最慢的一行」作为整单进度——报最快的那行会掩盖风险。
 */
export function summarizeOrderProgress(lines: readonly OrderLineProgress[]): {
  doneNodes: number
  totalNodes: number
  currentNode: string | null
  hasBlocked: boolean
} {
  if (lines.length === 0) {
    return { doneNodes: 0, totalNodes: 0, currentNode: null, hasBlocked: false }
  }

  const slowest = lines.reduce((worst, line) => (ratio(line) < ratio(worst) ? line : worst))

  return {
    doneNodes: slowest.doneNodes,
    totalNodes: slowest.totalNodes,
    currentNode: slowest.currentNode,
    hasBlocked: lines.some((line) => line.hasBlocked),
  }
}

/** 仅用于「哪一行最慢」的内部比较，不对外暴露成进度百分比。 */
function ratio(line: OrderLineProgress): number {
  return line.totalNodes === 0 ? 0 : line.doneNodes / line.totalNodes
}

function dwellHoursOf(node: TrackingNodeFacts): number | null {
  if (!node.startedAt) return null

  const end = node.finishedAt ?? new Date()
  const hours = (end.getTime() - node.startedAt.getTime()) / 3_600_000
  return Math.max(0, Math.round(hours * 100) / 100)
}

function normalize(value: string): string {
  return parseDecimal(value, '数量').toFixed()
}

/** 合格数不能超过投入数——超出说明上游报数有误，宁可截断也不要让完成数大于总数。 */
export function clampDone(done: string, total: string): string {
  return Decimal.min(parseDecimal(done, '完成数'), parseDecimal(total, '总数')).toFixed()
}
