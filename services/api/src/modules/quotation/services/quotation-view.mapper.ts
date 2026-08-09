import { PERMISSION_CODES, fromMinor, type CurrencyCode } from '@machining-erp/shared'

import { FX_SCALE } from './material-price-resolver'

import type { QuotationItemView } from '../dto/quotation-item-view.dto'
import type { QuotationTierView } from '../dto/quotation-tier-view.dto'
import type { QuotationView } from '../dto/quotation-view.dto'
import type {
  QuotationItemRecord,
  QuotationRecord,
  QuotationTierRecord,
} from '../repositories/quotation.repository.port'

const BPS_SCALE = 10_000

/** 谁能看到成本与毛利：报价工程师与审核人。业务员看到的对象里没有 cost 这一组。 */
export function canSeeCost(permissions: readonly string[]): boolean {
  return (
    permissions.includes(PERMISSION_CODES.COSTING_EDIT) ||
    permissions.includes(PERMISSION_CODES.QUOTE_APPROVE)
  )
}

function toTierView(
  tier: QuotationTierRecord,
  currency: CurrencyCode,
  withCost: boolean,
): QuotationTierView {
  const view: QuotationTierView = {
    minQuantity: tier.minQuantity,
    unitPrice: fromMinor({ minor: tier.unitPriceMinor, currency }),
    label: tier.label,
  }

  if (withCost) {
    view.cost = {
      unitCost: fromMinor({ minor: tier.unitCostMinor, currency }),
      grossMarginBps: grossMarginBps(tier.unitPriceMinor, tier.unitCostMinor),
    }
  }

  return view
}

/** 毛利率（万分比整数）=（报价 − 成本）/ 报价。报价为 0 时无意义，返回 0。 */
function grossMarginBps(unitPriceMinor: bigint, unitCostMinor: bigint): number {
  if (unitPriceMinor <= 0n) return 0
  return Number(((unitPriceMinor - unitCostMinor) * BigInt(BPS_SCALE)) / unitPriceMinor)
}

function toItemView(
  item: QuotationItemRecord,
  currency: CurrencyCode,
  withCost: boolean,
): QuotationItemView {
  return {
    id: item.id,
    sequence: item.sequence,
    productName: item.productName,
    drawingNo: item.drawingNo,
    drawingVersionId: item.drawingVersionId,
    revision: item.revision,
    material: item.material,
    finishing: item.finishing,
    process: item.process,
    costAnalysisLineId: item.costAnalysisLineId,
    remark: item.remark,
    tiers: item.tiers.map((tier) => toTierView(tier, currency, withCost)),
  }
}

export function toQuotationView(
  record: QuotationRecord,
  permissions: readonly string[],
): QuotationView {
  const currency = record.currency as CurrencyCode
  const withCost = canSeeCost(permissions)

  return {
    id: record.id,
    docNo: record.docNo,
    version: record.version,
    customerId: record.customerId,
    costAnalysisId: record.costAnalysisId,
    template: record.template,
    currency: record.currency,
    fxRate: record.fxRateMicros === null ? null : Number(record.fxRateMicros) / FX_SCALE,
    fxQuotedOn: record.fxQuotedOn?.toISOString() ?? null,
    // 模具费单列，不参与单件价换算
    moldFee: fromMinor({ minor: record.moldFeeMinor, currency }),
    terms: record.terms,
    status: record.status,
    validUntil: record.validUntil?.toISOString() ?? null,
    submittedBy: record.submittedBy,
    submittedAt: record.submittedAt?.toISOString() ?? null,
    approvedBy: record.approvedBy,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    rejectReason: record.rejectReason,
    items: record.items.map((item) => toItemView(item, currency, withCost)),
    versionLock: record.versionLock,
  }
}
