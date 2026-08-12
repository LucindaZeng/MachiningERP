import { ECN_IMPACT_SCOPE_LABEL } from '../constants/ecn-impact-scopes'

import type { EcnLinkageView } from './ecn-context.service'
import type { DocTimelineNodeView } from '../../shipment'
import type { EcnImpactView } from '../dto/ecn-impact-view.dto'
import type { EcnSignoffView } from '../dto/ecn-signoff-view.dto'
import type { EcnRequestView } from '../dto/ecn-view.dto'
import type { EcnRequestRecord } from '../repositories/ecn.repository.port'

/** 服务端枚举 → 前端那套小写值。界面是基线，映射在这里做完。 */
const STATUS_MAP: Record<EcnRequestRecord['status'], string> = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  ASSESSING: 'assessing',
  REVIEWING: 'reviewing',
  APPROVED: 'approved',
  EXECUTING: 'executing',
  CLOSED: 'closed',
  REJECTED: 'rejected',
}

const CHANGE_TYPE_MAP: Record<EcnRequestRecord['changeType'], string> = {
  DRAWING: 'drawing',
  MATERIAL: 'material',
  SURFACE: 'surface',
  PROCESS: 'process',
}

export interface EcnNaming {
  customerName: string
  orderNo: string | null
  ownerName: string
}

export function toEcnRequestView(
  record: EcnRequestRecord,
  naming: EcnNaming,
  linkage: EcnLinkageView,
  timeline: DocTimelineNodeView[],
): EcnRequestView {
  return {
    id: record.id,
    docNo: record.docNo,
    customerName: naming.customerName,
    ...(naming.orderNo ? { orderNo: naming.orderNo } : {}),
    productName: record.productName,
    drawingNo: record.drawingNo,
    changeType: CHANGE_TYPE_MAP[record.changeType],
    origin: record.origin === 'CUSTOMER' ? 'customer' : 'internal',
    urgent: record.urgent,
    beforeValue: record.beforeValue,
    afterValue: record.afterValue,
    reason: record.reason,
    impacts: record.impacts.map(toImpactView),
    routingUpdated: record.routingUpdated,
    ...(record.effectiveBatch ? { effectiveBatch: record.effectiveBatch } : {}),
    needRequote: record.needRequote,
    needOrderReapproval: record.needOrderReapproval,
    status: STATUS_MAP[record.status],
    owner: naming.ownerName,
    ...(record.submittedAt ? { submittedAt: toDateTimeText(record.submittedAt) } : {}),
    ...(record.rejectReason ? { rejectReason: record.rejectReason } : {}),
    linkage,
    signoffs: record.signoffs.map(toSignoffView),
    timeline,
    versionLock: record.versionLock,
  }
}

/**
 * 金额：**评不出钱出 '—'，评出零出 '0.00'**。
 * 两者在返工决策里含义相反（前者是「这项算不清」，后者是「这项确实没损失」），
 * 合并成 0 会让前一种情况看起来像已经评估过。
 */
function toImpactView(impact: EcnRequestRecord['impacts'][number]): EcnImpactView {
  return {
    scope: ECN_IMPACT_SCOPE_LABEL[impact.scope],
    quantity: impact.quantity,
    amount: impact.amountMinor === null ? '—' : toYuanText(impact.amountMinor),
    note: impact.note,
  }
}

function toSignoffView(signoff: EcnRequestRecord['signoffs'][number]): EcnSignoffView {
  return {
    department: signoff.department,
    signedBy: signoff.signedBy,
    signedAt: signoff.signedAt ? toDateTimeText(signoff.signedAt) : null,
    opinion: signoff.opinion,
    proxied: signoff.proxied,
  }
}

/** 整数分 → 两位小数字符串。金额在线上一律整数分，字符串形态只在 DTO 边界出现。 */
function toYuanText(minor: bigint): string {
  const negative = minor < 0n
  const absolute = negative ? -minor : minor
  const yuan = absolute / 100n
  const cents = absolute % 100n
  return `${negative ? '-' : ''}${yuan}.${String(cents).padStart(2, '0')}`
}

/** 与前端固件一致的 `YYYY-MM-DD HH:mm`。 */
function toDateTimeText(value: Date): string {
  const pad = (input: number): string => String(input).padStart(2, '0')
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ` +
    `${pad(value.getHours())}:${pad(value.getMinutes())}`
  )
}
