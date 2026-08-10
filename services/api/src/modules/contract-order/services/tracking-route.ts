import { STANDARD_TRACKING_ROUTE, type TrackingRouteNode } from '../constants/tracking-route'

export interface TrimmedRouteNode {
  sequence: number
  key: string
  node: string
  phase: string
  department: string
  /** 命中的工艺编号；固定节点与检验节点为 null */
  processCode: string | null
}

/**
 * 按产品工艺路线裁剪标准追踪链（业务规格 4.7「按产品工艺路线自动裁剪」）。
 *
 * 裁剪规则：
 * - 固定节点（订单评审、PMC、采购、到料、IQC、出货报告、入库）永远保留；
 * - 绑定工艺的节点，路线里出现任一对应工艺编号才保留；
 * - 检验节点跟随它前面的工艺节点——**前道工艺被裁掉，对应的品质检也必须一起裁掉**，
 *   否则会出现「没做表处却要等表处后品质检」这种永远走不完的链。
 *
 * 工艺路线为空时只剩固定节点：产品还没定工艺就下单（样品单常见），
 * 链条先立起来，等工程给出路线后再重建。
 */
export function trimTrackingRoute(
  processCodes: readonly string[],
  route: readonly TrackingRouteNode[] = STANDARD_TRACKING_ROUTE,
): TrimmedRouteNode[] {
  const routing = new Set(processCodes)
  const kept = new Map<string, string | null>()

  for (const node of route) {
    const matched = matchProcess(node, routing)
    if (matched === undefined) continue
    if (node.follows !== undefined && !kept.has(node.follows)) continue

    kept.set(node.key, matched)
  }

  return route
    .filter((node) => kept.has(node.key))
    .map((node, index) => ({
      sequence: index + 1,
      key: node.key,
      node: node.node,
      phase: node.phase,
      department: node.department,
      processCode: kept.get(node.key) ?? null,
    }))
}

/**
 * 返回命中的工艺编号；`undefined` 表示该节点应被裁掉，`null` 表示保留但不绑工艺。
 * 用 undefined/null 区分「裁掉」与「保留但无工艺」，比返回布尔再查一次表少一层。
 */
function matchProcess(node: TrackingRouteNode, routing: ReadonlySet<string>): string | null | undefined {
  if (node.processCodes === undefined) return null

  const hit = node.processCodes.find((code) => routing.has(code))
  return hit ?? undefined
}
