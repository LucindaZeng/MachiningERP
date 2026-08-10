import { addQuantity, fromMinor, parseDecimal, quantityOf, type CurrencyCode } from '@machining-erp/shared'

import { hasLeftFactory } from '../constants/shipment-states'
import { TAIL_PLAN_TO_WIRE } from '../constants/tail-plans'

import { tailQtyOf, totalTailQty } from './tail-balance.rules'

import type { TailPlanWire } from '../constants/tail-plans'
import type { DocTimelineNodeView } from '../dto/doc-timeline-node-view.dto'
import type { ShipmentLineView } from '../dto/shipment-line-view.dto'
import type { ShipmentView } from '../dto/shipment-view.dto'
import type {
  ShipmentLineRecord,
  ShipmentRecord,
} from '../repositories/shipment.repository.port'
import type { ShipmentStatus } from '@prisma/client'

const ZERO_QTY = quantityOf('0')

/** 单据号、客户名、业务员姓名都在别的模块里，由调用方查好传进来。 */
export interface ShipmentNaming {
  orderNo: string
  customerName: string
  ownerName: string
}

const STATUS_TO_WIRE: Record<ShipmentStatus, ShipmentView['status']> = {
  PLANNED: 'planned',
  PICKING: 'picking',
  PACKED: 'packed',
  SHIPPED: 'shipped',
  SIGNED: 'signed',
  INVOICED: 'invoiced',
  CLOSED: 'closed',
}

/** 行金额 = 本次发货数 × 单价，decimal 全程算完再取整到最小单位。 */
export function lineAmountMinor(line: ShipmentLineRecord): bigint {
  const amount = parseDecimal(line.shippedQty, '数量').mul(line.unitPriceMinor.toString())
  return BigInt(amount.toDecimalPlaces(0).toFixed(0))
}

function toLineView(line: ShipmentLineRecord, currency: CurrencyCode): ShipmentLineView {
  const view: ShipmentLineView = {
    seq: line.sequence,
    productName: line.productName,
    drawingNo: line.drawingNo,
    batchNo: line.batchNo,
    orderedQty: line.orderedQty,
    shippedQty: line.shippedQty,
    tailQty: tailQtyOf(line),
    amount: fromMinor({ minor: lineAmountMinor(line), currency }).amount,
  }
  if (line.itemCode) view.itemCode = line.itemCode
  return view
}

/** 表头产品名：单行取行名，多行取「首行 等 N 项」，与前端 fixture 的写法一致。 */
function headerProductName(lines: readonly ShipmentLineRecord[]): string {
  const first = lines[0]
  if (!first) return ''
  return lines.length === 1 ? first.productName : `${first.productName} 等 ${lines.length} 项`
}

/**
 * 表头的尾数方案：所有还有尾数的行方案一致时才透出。
 * 不一致就留空——一个「多数派方案」标签会让人误以为整单都这么处理。
 */
function headerTailPlan(lines: readonly ShipmentLineRecord[]): TailPlanWire | undefined {
  const plans = lines
    .filter((line) => parseDecimal(tailQtyOf(line), '尾数').greaterThan(0))
    .map((line) => line.tailPlan)
  if (plans.length === 0 || plans.some((plan) => plan === null)) return undefined

  const first = plans[0]
  return plans.every((plan) => plan === first) ? TAIL_PLAN_TO_WIRE[first!] : undefined
}

function sumQty(lines: readonly ShipmentLineRecord[], pick: (line: ShipmentLineRecord) => string): string {
  return lines.reduce((sum, line) => addQuantity(sum, pick(line)), ZERO_QTY)
}

export function toShipmentView(
  record: ShipmentRecord,
  naming: ShipmentNaming,
  timeline: DocTimelineNodeView[],
): ShipmentView {
  const currency = record.currency as CurrencyCode
  const total = record.lines.reduce((sum, line) => sum + lineAmountMinor(line), 0n)
  const tailPlan = headerTailPlan(record.lines)

  const view: ShipmentView = {
    id: record.id,
    docNo: record.docNo,
    orderNo: naming.orderNo,
    customerName: naming.customerName,
    productName: headerProductName(record.lines),
    lines: record.lines.map((line) => toLineView(line, currency)),
    batchNo: record.lines[0]?.batchNo ?? '',
    orderedQty: sumQty(record.lines, (line) => line.orderedQty),
    qualifiedQty: sumQty(record.lines, (line) => line.qualifiedQty),
    packedQty: sumQty(record.lines, (line) => line.packedQty),
    // 「已发」在真正出运之前是 0：行上的 shippedQty 是本单计划发多少，不是已经发了多少
    shippedQty: hasLeftFactory(record.status)
      ? sumQty(record.lines, (line) => line.shippedQty)
      : ZERO_QTY,
    tailQty: totalTailQty(record.lines),
    amount: fromMinor({ minor: total, currency }),
    status: STATUS_TO_WIRE[record.status],
    owner: naming.ownerName,
    timeline,
    versionLock: record.versionLock,
  }

  if (tailPlan) view.tailPlan = tailPlan
  if (record.packedAt) view.packedAt = record.packedAt.toISOString()
  if (record.shippedAt) view.shippedAt = record.shippedAt.toISOString()
  if (record.signedAt) view.signedAt = record.signedAt.toISOString()
  if (record.carrier) view.carrier = record.carrier
  if (record.trackingNo) view.trackingNo = record.trackingNo
  if (record.invoiceNo) view.invoiceNo = record.invoiceNo

  return view
}
