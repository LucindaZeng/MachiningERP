import type { TimelineNodeStatus } from '@prisma/client'

export interface TimelineNodeRecord {
  id: string
  docType: string
  docId: string
  node: string
  sequence: number
  status: TimelineNodeStatus
  enteredAt: Date
  leftAt: Date | null
  durationMs: bigint | null
  ownerUserCode: string | null
  ownerDept: string | null
  remark: string | null
}

export interface OpenNodeInput {
  docType: string
  docId: string
  node: string
  sequence: number
  ownerUserCode?: string | null
  ownerDept?: string | null
  remark?: string | null
}

export interface CloseNodeInput {
  id: string
  leftAt: Date
  durationMs: bigint
  status: TimelineNodeStatus
}

export interface DocTimelineRepositoryPort {
  findOpenNode(docType: string, docId: string): Promise<TimelineNodeRecord | null>
  listByDoc(docType: string, docId: string): Promise<TimelineNodeRecord[]>
  openNode(input: OpenNodeInput): Promise<TimelineNodeRecord>
  closeNode(input: CloseNodeInput): Promise<void>
}

export const DOC_TIMELINE_REPOSITORY = Symbol('DOC_TIMELINE_REPOSITORY')
