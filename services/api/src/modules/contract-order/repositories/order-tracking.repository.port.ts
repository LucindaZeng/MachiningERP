import type { TrackNodeStatus } from '@prisma/client'

export interface TrackingNodeRecord {
  id: string
  orderLineId: string
  sequence: number
  processCode: string | null
  node: string
  phase: string
  department: string
  status: TrackNodeStatus
  qtyIn: string | null
  qtyOk: string | null
  qtyNg: string | null
  startedAt: Date | null
  finishedAt: Date | null
  remark: string | null
}

export type TrackingNodeDraft = Omit<TrackingNodeRecord, 'id'>

/** 事件带来的进度更新。数量一律 decimal 字符串。 */
export interface TrackingNodeProgressPatch {
  status?: TrackNodeStatus
  qtyIn?: string | null
  qtyOk?: string | null
  qtyNg?: string | null
  startedAt?: Date | null
  finishedAt?: Date | null
  remark?: string | null
}

export interface OrderTrackingRepositoryPort {
  listByOrderLine(orderLineId: string): Promise<TrackingNodeRecord[]>
  listByOrder(orderId: string): Promise<Map<string, TrackingNodeRecord[]>>
  /** 建链：整行替换，重建时先清空旧节点 */
  replaceNodes(orderLineId: string, nodes: TrackingNodeDraft[]): Promise<TrackingNodeRecord[]>
  findNode(orderLineId: string, sequence: number): Promise<TrackingNodeRecord | null>
  updateNode(id: string, patch: TrackingNodeProgressPatch): Promise<TrackingNodeRecord | null>
}

export const ORDER_TRACKING_REPOSITORY = Symbol('ORDER_TRACKING_REPOSITORY')
