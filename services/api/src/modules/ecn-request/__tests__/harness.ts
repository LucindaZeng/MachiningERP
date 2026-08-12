import { EcnApprovalService } from '../services/ecn-approval.service'
import { EcnContextService } from '../services/ecn-context.service'
import { EcnImpactService } from '../services/ecn-impact.service'
import { EcnReadService } from '../services/ecn-read.service'
import { EcnRequestFacade } from '../services/ecn-request.facade'
import { EcnRequestService } from '../services/ecn-request.service'

import type {
  CreateEcnRequestData,
  EcnImpactDraft,
  EcnQuery,
  EcnRepositoryPort,
  EcnRequestPatch,
  EcnRequestRecord,
  EcnSignoffRecord,
} from '../repositories/ecn.repository.port'

/**
 * ECN 的内存测试台。
 *
 * 仓储用**克隆式**假实现而不是 jest mock：本模块处处依赖乐观锁
 * （每个动作都带 versionLock 出去、拿新记录回来），共享引用的假仓储
 * 会让「版本号有没有递增」这件事测不出来——而那正是最容易写错的地方。
 */
export class FakeEcnRepository implements EcnRepositoryPort {
  readonly rows: EcnRequestRecord[] = []
  private sequence = 0

  async create(data: CreateEcnRequestData): Promise<EcnRequestRecord> {
    this.sequence += 1
    const record: EcnRequestRecord = {
      ...data,
      id: `ECN-${this.sequence}`,
      routingUpdated: false,
      effectiveBatch: null,
      needRequote: false,
      needOrderReapproval: false,
      status: 'DRAFT',
      submittedAt: null,
      assessedBy: null,
      assessedAt: null,
      approvedBy: null,
      approvedAt: null,
      closedAt: null,
      rejectReason: null,
      impacts: [],
      signoffs: [],
      versionLock: 0,
    }
    this.rows.push(record)
    return clone(record)
  }

  async findById(id: string): Promise<EcnRequestRecord | null> {
    const found = this.rows.find((row) => row.id === id)
    return found ? clone(found) : null
  }

  async list(query: EcnQuery): Promise<EcnRequestRecord[]> {
    return this.rows
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => !query.customerId || row.customerId === query.customerId)
      .filter((row) => !query.changeType || row.changeType === query.changeType)
      .map(clone)
  }

  async patch(
    id: string,
    versionLock: number,
    patch: EcnRequestPatch,
  ): Promise<EcnRequestRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    if (!row || row.versionLock !== versionLock) return null

    const { updatedBy: _updatedBy, ...rest } = patch
    Object.assign(row, rest)
    row.versionLock += 1
    return clone(row)
  }

  async replaceImpacts(
    id: string,
    versionLock: number,
    impacts: readonly EcnImpactDraft[],
  ): Promise<EcnRequestRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    if (!row || row.versionLock !== versionLock) return null

    row.impacts = impacts.map((impact, index) => ({ ...impact, id: `IMP-${index + 1}` }))
    row.versionLock += 1
    return clone(row)
  }

  async recordSignoffs(
    id: string,
    versionLock: number,
    signoffs: ReadonlyArray<Omit<EcnSignoffRecord, 'id'>>,
  ): Promise<EcnRequestRecord | null> {
    const row = this.rows.find((item) => item.id === id)
    if (!row || row.versionLock !== versionLock) return null

    for (const signoff of signoffs) {
      const existing = row.signoffs.find((item) => item.department === signoff.department)
      if (existing) Object.assign(existing, signoff)
      else row.signoffs.push({ ...signoff, id: `SGN-${row.signoffs.length + 1}` })
    }
    row.versionLock += 1
    return clone(row)
  }
}

/**
 * 深拷贝。手写而不用现成的两种，各有原因：
 * - `JSON.stringify` 往返：记录里的金额是 **BigInt**，它直接抛错；
 * - `structuredClone`：在 jest 的 sandbox 里造出来的 `Date` 属于**另一个 realm**，
 *   `toBeInstanceOf(Date)` 会得到「Expected: Date, Received: Date」这种看不懂的失败。
 *
 * 因此这里用本 realm 的构造函数重建 Date，BigInt 与其余原始值原样带过。
 */
function clone<T>(value: T): T {
  if (value instanceof Date) return new Date(value.getTime()) as T
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T
  if (value !== null && typeof value === 'object') {
    const copy: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) copy[key] = clone(item)
    return copy as T
  }
  return value
}

export interface EcnHarness {
  repository: FakeEcnRepository
  requests: EcnRequestService
  impacts: EcnImpactService
  approvals: EcnApprovalService
  reads: EcnReadService
  facade: EcnRequestFacade
  audits: Array<Record<string, unknown>>
  notifications: Array<Record<string, unknown>>
  timelineNodes: Array<Record<string, unknown>>
}

export const SALES: { userCode: string; permissions: string[] } = {
  userCode: 'WFX-2018-0042',
  permissions: ['sales.operate'],
}

export const ENGINEER: { userCode: string; permissions: string[] } = {
  userCode: 'WFX-2019-0011',
  permissions: ['quote.approve'],
}

export function buildHarness(): EcnHarness {
  const repository = new FakeEcnRepository()
  const audits: Array<Record<string, unknown>> = []
  const notifications: Array<Record<string, unknown>> = []
  const timelineNodes: Array<Record<string, unknown>> = []

  let docSequence = 0
  const numbering = {
    next: async () => {
      docSequence += 1
      return `ECN-20260811-${String(docSequence).padStart(4, '0')}`
    },
  }
  const audit = { record: async (entry: Record<string, unknown>) => void audits.push(entry) }
  const timeline = {
    enter: async (input: Record<string, unknown>) => void timelineNodes.push(input),
  }
  const notification = {
    notify: async (input: Record<string, unknown>) => {
      notifications.push(input)
      return input
    },
  }

  const requests = new EcnRequestService(
    numbering as never,
    audit as never,
    timeline as never,
    repository,
  )
  const impacts = new EcnImpactService(requests, audit as never, repository)
  const approvals = new EcnApprovalService(
    requests,
    notification as never,
    audit as never,
    repository,
  )

  const context = new EcnContextService(
    { load: async (id: string) => ({ orderType: 'FORMAL', docNo: `SO-${id}` }) } as never,
    { profileFor: async (id: string) => ({ name: `客户-${id}` }) } as never,
    { findByUserCode: async (code: string) => ({ displayName: `姓名-${code}` }) } as never,
    { loadVersion: async (id: string) => ({ revision: `REV ${id}` }) } as never,
  )
  const reads = new EcnReadService(requests, context, { list: async () => [] } as never)
  const facade = new EcnRequestFacade(requests, context, reads)

  return {
    repository, requests, impacts, approvals, reads, facade,
    audits, notifications, timelineNodes,
  }
}

/** 四项影响评估的标准入参。 */
export const FULL_IMPACTS = [
  { scope: 'WIP', quantity: '1200 件', amountMinor: '1411200', note: 'CNC 已加工待转序' },
  { scope: 'PURCHASED', quantity: '5000 件用量', amountMinor: '2150000', note: '棒料可继续使用' },
  { scope: 'FINISHED_STOCK', quantity: '0 件', amountMinor: '0', note: '无' },
  { scope: 'SHIPPED', quantity: '0 件', amountMinor: null, note: '无' },
]

/** 建一张已提交的改图 ECN。 */
export async function submittedDrawingEcn(harness: EcnHarness): Promise<EcnRequestRecord> {
  return harness.requests.create(
    {
      customerId: 'C1',
      orderId: 'O1',
      productName: '连接器外壳 CNC 件',
      drawingNo: 'HS-4471-A',
      drawingVersionId: 'DV-1',
      newDrawingVersionId: 'DV-2',
      bomRequestId: 'BR-1',
      quotationId: 'Q-1',
      changeType: 'DRAWING',
      origin: 'CUSTOMER',
      urgent: true,
      beforeValue: 'Rev.C 沉孔 φ6.2±0.05',
      afterValue: 'Rev.D 沉孔 φ6.5±0.03',
      reason: '客户端装配干涉',
    },
    { orderType: 'FORMAL', docNo: 'SO-1' },
    SALES,
  )
}
