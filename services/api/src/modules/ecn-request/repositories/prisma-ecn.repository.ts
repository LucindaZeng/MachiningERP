import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'
import { ECN_IMPACT_SCOPE_ORDER } from '../constants/ecn-impact-scopes'

import type {
  CreateEcnRequestData,
  EcnImpactDraft,
  EcnQuery,
  EcnRepositoryPort,
  EcnRequestPatch,
  EcnRequestRecord,
  EcnSignoffRecord,
} from './ecn.repository.port'
import type { EcnImpact, EcnRequest, EcnSignoff } from '@prisma/client'

const DEFAULT_LIMIT = 100

type EcnRow = EcnRequest & { impacts: EcnImpact[]; signoffs: EcnSignoff[] }

const WITH_ALL = { impacts: true, signoffs: { orderBy: { department: 'asc' as const } } }

/** 薄适配器：只做数据访问，不含任何业务规则。 */
@Injectable()
export class PrismaEcnRepository implements EcnRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateEcnRequestData): Promise<EcnRequestRecord> {
    return toRecord(
      await this.prisma.ecnRequest.create({ data: { ...data }, include: WITH_ALL }),
    )
  }

  async findById(id: string): Promise<EcnRequestRecord | null> {
    const row = await this.prisma.ecnRequest.findUnique({ where: { id }, include: WITH_ALL })
    return row ? toRecord(row) : null
  }

  async list(query: EcnQuery): Promise<EcnRequestRecord[]> {
    const rows = await this.prisma.ecnRequest.findMany({
      where: {
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.orderId ? { orderId: query.orderId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.changeType ? { changeType: query.changeType } : {}),
        ...(query.ownerUserCode ? { ownerUserCode: query.ownerUserCode } : {}),
      },
      include: WITH_ALL,
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? DEFAULT_LIMIT,
    })
    return rows.map(toRecord)
  }

  /** 乐观锁走 updateMany：影响行数为 0 即版本冲突。 */
  async patch(
    id: string,
    versionLock: number,
    patch: EcnRequestPatch,
  ): Promise<EcnRequestRecord | null> {
    const { count } = await this.prisma.ecnRequest.updateMany({
      where: { id, versionLock },
      data: { ...patch, versionLock: { increment: 1 } },
    })
    return count === 0 ? null : this.findById(id)
  }

  async replaceImpacts(
    id: string,
    versionLock: number,
    impacts: readonly EcnImpactDraft[],
    updatedBy: string,
  ): Promise<EcnRequestRecord | null> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.ecnRequest.updateMany({
        where: { id, versionLock },
        data: { updatedBy, versionLock: { increment: 1 } },
      })
      if (count === 0) return false

      await tx.ecnImpact.deleteMany({ where: { ecnId: id } })
      await tx.ecnImpact.createMany({
        data: impacts.map((impact) => ({ ...impact, ecnId: id })),
      })
      return true
    })

    return updated ? this.findById(id) : null
  }

  async recordSignoffs(
    id: string,
    versionLock: number,
    signoffs: ReadonlyArray<Omit<EcnSignoffRecord, 'id'>>,
    updatedBy: string,
  ): Promise<EcnRequestRecord | null> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.ecnRequest.updateMany({
        where: { id, versionLock },
        data: { updatedBy, versionLock: { increment: 1 } },
      })
      if (count === 0) return false

      for (const signoff of signoffs) {
        await tx.ecnSignoff.upsert({
          where: { ecnId_department: { ecnId: id, department: signoff.department } },
          create: { ...signoff, ecnId: id },
          update: {
            signedBy: signoff.signedBy,
            signedAt: signoff.signedAt,
            opinion: signoff.opinion,
            proxied: signoff.proxied,
          },
        })
      }
      return true
    })

    return updated ? this.findById(id) : null
  }
}

function toRecord(row: EcnRow): EcnRequestRecord {
  return {
    id: row.id,
    docNo: row.docNo,
    customerId: row.customerId,
    orderId: row.orderId,
    productName: row.productName,
    drawingNo: row.drawingNo,
    drawingVersionId: row.drawingVersionId,
    newDrawingVersionId: row.newDrawingVersionId,
    bomRequestId: row.bomRequestId,
    quotationId: row.quotationId,
    changeType: row.changeType,
    origin: row.origin,
    urgent: row.urgent,
    beforeValue: row.beforeValue,
    afterValue: row.afterValue,
    reason: row.reason,
    routingUpdated: row.routingUpdated,
    effectiveBatch: row.effectiveBatch,
    needRequote: row.needRequote,
    needOrderReapproval: row.needOrderReapproval,
    status: row.status,
    ownerUserCode: row.ownerUserCode,
    submittedAt: row.submittedAt,
    assessedBy: row.assessedBy,
    assessedAt: row.assessedAt,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
    closedAt: row.closedAt,
    rejectReason: row.rejectReason,
    // 展示顺序即评估顺序：在制 → 已采购 → 已完工 → 已发货
    impacts: [...row.impacts]
      .sort((left, right) => ECN_IMPACT_SCOPE_ORDER[left.scope] - ECN_IMPACT_SCOPE_ORDER[right.scope])
      .map((impact) => ({
        id: impact.id,
        scope: impact.scope,
        quantity: impact.quantity,
        amountMinor: impact.amountMinor,
        note: impact.note,
      })),
    signoffs: row.signoffs.map((signoff) => ({
      id: signoff.id,
      department: signoff.department,
      signedBy: signoff.signedBy,
      signedAt: signoff.signedAt,
      opinion: signoff.opinion,
      proxied: signoff.proxied,
    })),
    versionLock: row.versionLock,
  }
}
