import {
  PERMISSION_CODES,
  SALES_RETURN_ERRORS,
  parseDecimal,
} from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { isReturnClosed, isReturnEditable } from '../constants/return-states'
import { RETURN_TIMELINE_NODES } from '../constants/return-timeline'
import {
  SALES_RETURN_REPOSITORY,
  type SalesReturnLineDraft,
  type SalesReturnQuery,
  type SalesReturnRecord,
  type SalesReturnRepositoryPort,
} from '../repositories/sales-return.repository.port'

import type { ShippedLineFacts } from './return-context.service'

export interface ReturnActor {
  userCode: string
  permissions: readonly string[]
}

export interface RegisterReturnInput {
  orderId: string
  shipmentId: string | null
  customerId: string
  currency: string
  reason: string
  eightDNo: string | null
  eightDRequired: boolean
  complaintAt: Date
  lines: SalesReturnLineDraft[]
}

/**
 * 客诉 / 退货登记与读取（RMA-01）。
 *
 * 登记时的两条硬校验：
 * 1. 至少一行，且每行必须挂在原出货行上——脱不开出货行，批次追溯才成立；
 * 2. 退货数不得超过该出货行的实发数，否则会退出一个厂里根本没发出去的量。
 *
 * 责任归属与处置**不在登记时填**：登记的是「客户说货有问题」，
 * 判定是品质部后一步的事。让登记人自己认定责任，等于让被投诉方给自己打分。
 */
@Injectable()
export class SalesReturnService {
  constructor(
    private readonly docNumber: DocNumberService,
    private readonly audit: AuditService,
    private readonly timeline: DocTimelineService,
    @Inject(SALES_RETURN_REPOSITORY) private readonly repository: SalesReturnRepositoryPort,
  ) {}

  static assertSales(actor: ReturnActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.SALES_OPERATE)) {
      throw new BizError(SALES_RETURN_ERRORS.SALES_ROLE_REQUIRED)
    }
  }

  static assertQuality(actor: ReturnActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.QUALITY_RMA_JUDGE)) {
      throw new BizError(SALES_RETURN_ERRORS.QUALITY_ROLE_REQUIRED)
    }
  }

  static assertFinance(actor: ReturnActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.ORDER_FINANCE_REVIEW)) {
      throw new BizError(SALES_RETURN_ERRORS.FINANCE_ROLE_REQUIRED)
    }
  }

  async register(input: RegisterReturnInput, actor: ReturnActor, shipped: readonly ShippedLineFacts[]): Promise<SalesReturnRecord> {
    SalesReturnService.assertSales(actor)
    assertReturnableLines(input.lines, shipped)

    const docNo = await this.docNumber.next(DOC_TYPES.SALES_RETURN)
    const record = await this.repository.create({
      docNo,
      orderId: input.orderId,
      shipmentId: input.shipmentId,
      customerId: input.customerId,
      currency: input.currency,
      reason: input.reason,
      eightDNo: input.eightDNo,
      eightDRequired: input.eightDRequired,
      ownerUserCode: actor.userCode,
      complaintAt: input.complaintAt,
      createdBy: actor.userCode,
      lines: [...input.lines],
    })

    await this.timeline.enter({
      docType: DOC_TYPES.SALES_RETURN,
      docId: record.id,
      node: RETURN_TIMELINE_NODES.REGISTERED.node,
      ownerUserCode: actor.userCode,
      ownerDept: RETURN_TIMELINE_NODES.REGISTERED.ownerDept,
    })
    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'sales-return.register',
      entityType: 'SalesReturn',
      entityId: record.docNo,
      after: {
        orderId: record.orderId,
        shipmentId: record.shipmentId,
        lineCount: record.lines.length,
      },
    })

    return record
  }

  async load(id: string): Promise<SalesReturnRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new BizError(SALES_RETURN_ERRORS.NOT_FOUND)
    return record
  }

  list(query: SalesReturnQuery): Promise<SalesReturnRecord[]> {
    return this.repository.list(query)
  }

}

/**
 * 登记数量校验。第一条不过就直接抛——
 * 第二条依赖「行确实挂在出货行上」这个前提，先过完再谈。
 */
export function assertReturnableLines(
  lines: readonly SalesReturnLineDraft[],
  shipped: readonly ShippedLineFacts[],
): void {
  if (lines.length === 0 || lines.some((line) => !line.shipmentLineId)) {
    throw new BizError(SALES_RETURN_ERRORS.LINES_REQUIRED)
  }

  const byId = new Map(shipped.map((line) => [line.shipmentLineId, line]))
  for (const line of lines) {
    const source = byId.get(line.shipmentLineId ?? '')
    if (!source) {
      throw new BizError(SALES_RETURN_ERRORS.LINES_REQUIRED, {
        message: `退货第 ${line.sequence} 行引用的出货行不属于该出货单`,
        details: { sequence: line.sequence, shipmentLineId: line.shipmentLineId },
      })
    }

    if (parseDecimal(line.returnQty, '数量').greaterThan(parseDecimal(source.shippedQty, '数量'))) {
      throw new BizError(SALES_RETURN_ERRORS.QTY_EXCEEDS_SHIPPED, {
        message:
          `退货第 ${line.sequence} 行超退：该行实发 ${source.shippedQty}，` +
          `本次要退 ${line.returnQty}`,
        details: {
          sequence: line.sequence,
          shippedQty: source.shippedQty,
          requested: line.returnQty,
        },
      })
    }
  }
}

/**
 * 金额类改动的守门人：结案即锁死。
 *
 * 与「已发出的对账单不可变」是同一条规则的两端——
 * 对账单已经按结案金额算过一版了，事后改这里等于偷偷改掉客户签回的那份。
 * 要更正只能另开单据。
 */
export function assertAmountsMutable(record: SalesReturnRecord): void {
  if (isReturnClosed(record.status)) {
    throw new BizError(SALES_RETURN_ERRORS.CLOSED_IS_IMMUTABLE, {
      details: { docNo: record.docNo, closedAt: record.closedAt?.toISOString() ?? null },
    })
  }
  // 执行中（EXECUTING）只剩仓储登记入库这一类动作，金额与处置同样锁上；
  // 不成立（REJECTED）根本不该有金额。两者共用 NOT_EDITABLE。
  if (!isReturnEditable(record.status)) {
    throw new BizError(SALES_RETURN_ERRORS.NOT_EDITABLE, {
      details: { docNo: record.docNo, status: record.status },
    })
  }
}
