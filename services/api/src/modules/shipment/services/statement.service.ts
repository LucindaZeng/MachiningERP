import { PERMISSION_CODES, STATEMENT_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import { statementStateMachine } from '../constants/statement-states'
import {
  STATEMENT_REPOSITORY,
  type CreateStatementData,
  type StatementQuery,
  type StatementRecord,
  type StatementRepositoryPort,
} from '../repositories/statement.repository.port'

import { ShipmentContextService } from './shipment-context.service'
import { aggregateStatement, orderEntries, signedAmountOf, type StatementBasis } from './statement-aggregation'
import { StatementSourceService } from './statement-source.service'

import type { ShipmentActor } from './shipment.service'
import type { StatementStatus } from '@prisma/client'

export interface GenerateStatementInput {
  customerId: string
  periodFrom: Date
  periodTo: Date
  basis: StatementBasis
  customerClosingMinor: bigint | null
}

/**
 * 客户对账单（业务规格第 7 章末段）。
 *
 * 三条不可让步的规则：
 * 1. **金额只从源单来**——本服务没有任何接受金额入参的方法，想改数字只能改源单；
 * 2. **差异非零必须说明**——差异不写清楚，就会在月复一月的对账里沉下去；
 * 3. **已发出的版本不可变**——重算产出新版本，旧版原样留给客户签回的那份对照。
 */
@Injectable()
export class StatementService {
  constructor(
    private readonly docNumber: DocNumberService,
    private readonly audit: AuditService,
    private readonly sources: StatementSourceService,
    private readonly context: ShipmentContextService,
    @Inject(STATEMENT_REPOSITORY) private readonly repository: StatementRepositoryPort,
  ) {}

  static assertSales(actor: ShipmentActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.SALES_OPERATE)) {
      throw new BizError(STATEMENT_ERRORS.SALES_ROLE_REQUIRED)
    }
  }

  /** 生成或重算。同一客户同一期间已有版本时，版本号递增，旧版一个字都不动。 */
  async generate(input: GenerateStatementInput, actor: ShipmentActor): Promise<StatementRecord> {
    StatementService.assertSales(actor)
    if (input.periodFrom.getTime() > input.periodTo.getTime()) {
      throw new BizError(STATEMENT_ERRORS.PERIOD_INVALID)
    }

    const customer = await this.context.customerContext(input.customerId)
    const [entries, opening, overdue, previousVersion] = await Promise.all([
      this.sources.collect(input.customerId, input.periodFrom, input.periodTo),
      this.sources.openingBalance(input.customerId, input.periodFrom),
      this.sources.overdue(input.customerId),
      this.repository.latestVersion(input.customerId, input.periodFrom, input.periodTo),
    ])

    const ordered = orderEntries(entries)
    const totals = aggregateStatement({
      openingBalanceMinor: opening,
      basis: input.basis,
      entries: ordered,
      overdueAmountMinor: overdue,
      customerClosingMinor: input.customerClosingMinor,
    })

    const docNo = await this.docNumber.next(DOC_TYPES.STATEMENT)
    const data: CreateStatementData = {
      ...totals,
      docNo,
      customerId: input.customerId,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      currency: customer.currency,
      version: previousVersion + 1,
      differenceNote: null,
      ownerUserCode: actor.userCode,
      createdBy: actor.userCode,
      lines: ordered.map((entry, index) => ({
        sequence: index + 1,
        occurredAt: entry.occurredAt,
        type: entry.type,
        docNo: entry.docNo,
        productName: entry.productName,
        quantity: entry.quantity,
        amountMinor: signedAmountOf(entry.type, entry.amountMinor),
        matched: false,
        remark: entry.remark,
      })),
    }

    const record = await this.repository.create(data)
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'statement.generate',
      entityType: 'Statement',
      entityId: record.docNo,
      after: {
        customerCode: customer.customerCode,
        version: record.version,
        closingBalanceMinor: record.closingBalanceMinor.toString(),
      },
    })

    return record
  }

  /** 发出给客户签回。差异非零而没有说明的，不许发。 */
  async send(id: string, versionLock: number, actor: ShipmentActor): Promise<StatementRecord> {
    StatementService.assertSales(actor)
    const current = await this.load(id)
    assertDifferenceExplained(current)

    return this.transition(current, versionLock, 'SENT', actor, { sentAt: new Date() })
  }

  async confirm(id: string, versionLock: number, actor: ShipmentActor): Promise<StatementRecord> {
    StatementService.assertSales(actor)
    const current = await this.load(id)
    return this.transition(current, versionLock, 'CONFIRMED', actor, { confirmedAt: new Date() })
  }

  /** 客户提出差异：说明必填，差异回到源单处理，处理完重新发一版。 */
  async dispute(
    id: string,
    versionLock: number,
    differenceNote: string,
    actor: ShipmentActor,
  ): Promise<StatementRecord> {
    StatementService.assertSales(actor)
    const trimmed = differenceNote.trim()
    if (!trimmed) throw new BizError(STATEMENT_ERRORS.DIFFERENCE_NOTE_REQUIRED)

    const current = await this.load(id)
    return this.transition(current, versionLock, 'DISPUTED', actor, { differenceNote: trimmed })
  }

  async settle(id: string, versionLock: number, actor: ShipmentActor): Promise<StatementRecord> {
    StatementService.assertSales(actor)
    const current = await this.load(id)
    return this.transition(current, versionLock, 'SETTLED', actor, {})
  }

  /** 客户核对状态：对账单上唯一允许人工改的字段，金额一概不可改。 */
  async setLineMatched(
    id: string,
    lineId: string,
    matched: boolean,
    actor: ShipmentActor,
  ): Promise<StatementRecord> {
    StatementService.assertSales(actor)
    const current = await this.load(id)
    const ok = await this.repository.setLineMatched(current.id, lineId, matched)
    if (!ok) throw new BizError(STATEMENT_ERRORS.LINE_NOT_FOUND)

    return this.load(id)
  }

  async load(id: string): Promise<StatementRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new BizError(STATEMENT_ERRORS.NOT_FOUND)
    return record
  }

  list(query: StatementQuery): Promise<StatementRecord[]> {
    return this.repository.list(query)
  }

  private async transition(
    current: StatementRecord,
    versionLock: number,
    target: StatementStatus,
    actor: ShipmentActor,
    extra: { sentAt?: Date; confirmedAt?: Date; differenceNote?: string },
  ): Promise<StatementRecord> {
    statementStateMachine.assert(current.status, target)

    const updated = await this.repository.patch(current.id, versionLock, {
      ...extra,
      status: target,
      updatedBy: actor.userCode,
    })
    if (!updated) throw new BizError(STATEMENT_ERRORS.NOT_EDITABLE)

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: `statement.${target.toLowerCase()}`,
      entityType: 'Statement',
      entityId: updated.docNo,
      before: { status: current.status },
      after: { status: updated.status },
    })

    return updated
  }
}

/** 差异不为零就必须有说明——这条在「发出」这一步卡死，别让没说清的差异出门。 */
export function assertDifferenceExplained(record: StatementRecord): void {
  if (record.differenceAmountMinor === 0n) return
  if (record.differenceNote && record.differenceNote.trim().length > 0) return

  throw new BizError(STATEMENT_ERRORS.DIFFERENCE_NOTE_REQUIRED, {
    details: { differenceAmountMinor: record.differenceAmountMinor.toString() },
  })
}
