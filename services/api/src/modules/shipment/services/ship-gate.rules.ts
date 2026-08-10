import type { PaymentTerm } from '@prisma/client'

/**
 * 出货双闸门的判定规则（业务规格第 7 章）：
 *
 * > 出货校验：品质放行结论与财务信用检查（按付款条件：预付/现金客户未收款到位时阻断出货）
 * > 通过后方可过账。
 *
 * 纯函数，不碰 IO——放行结论与回款金额由调用方从各自读端口取好传进来。
 * 两道闸门**分别判定、一次列全**：只报第一条会让业务员补完品质又被信用拦一次。
 */

/** 需要「款到才能发货」的付款条件。月结类客户按账期发货，不看回款。 */
const PREPAY_TERMS: ReadonlySet<PaymentTerm> = new Set<PaymentTerm>([
  'DEPOSIT_THEN_BALANCE',
  'CASH_BEFORE_SHIPMENT',
])

export type ShipGateName = 'QC_RELEASE' | 'CREDIT'

export interface ShipGateIssue {
  gate: ShipGateName
  message: string
}

/** 逐行的品质放行结论：一行没放行，整单就不能发。 */
export interface QcLineFacts {
  drawingNo: string
  batchNo: string
  released: boolean
  reason: string | null
}

export interface CreditFacts {
  paymentTerm: PaymentTerm
  /** 本单应收（最小货币单位） */
  payableMinor: bigint
  /** 该订单已收（最小货币单位） */
  receivedMinor: bigint
  currency: string
}

export function needsPrepayment(term: PaymentTerm): boolean {
  return PREPAY_TERMS.has(term)
}

/** 品质闸门：任一行未放行即拦，未放行的行全部列出来。 */
export function collectQcIssues(lines: readonly QcLineFacts[]): ShipGateIssue[] {
  return lines
    .filter((line) => !line.released)
    .map((line) => ({
      gate: 'QC_RELEASE' as const,
      message:
        `${line.drawingNo} 批次 ${line.batchNo} 未取得品质放行` +
        (line.reason ? `：${line.reason}` : ''),
    }))
}

/**
 * 信用闸门：只对预付/现金客户生效，且必须**全额**到账。
 * 「预付一定比例」的客户剩余款项也要在出货前付清（付款条件①的字面含义），
 * 所以这里比的是全额而不是预付比例。
 */
export function collectCreditIssues(facts: CreditFacts): ShipGateIssue[] {
  if (!needsPrepayment(facts.paymentTerm)) return []
  if (facts.receivedMinor >= facts.payableMinor) return []

  const shortfall = facts.payableMinor - facts.receivedMinor
  return [
    {
      gate: 'CREDIT',
      message:
        `付款条件为${paymentTermLabel(facts.paymentTerm)}，出货前需款项全部到位；` +
        `本单应收 ${facts.payableMinor} 已收 ${facts.receivedMinor}，尚差 ${shortfall}（${facts.currency} 最小单位）`,
    },
  ]
}

/** 两道闸门一次跑完，失败项合并返回；空数组即放行。 */
export function collectShipGateIssues(
  qcLines: readonly QcLineFacts[],
  credit: CreditFacts,
): ShipGateIssue[] {
  return [...collectQcIssues(qcLines), ...collectCreditIssues(credit)]
}

export function paymentTermLabel(term: PaymentTerm): string {
  switch (term) {
    case 'DEPOSIT_THEN_BALANCE':
      return '预付比例 + 出货前付清'
    case 'CASH_BEFORE_SHIPMENT':
      return '现金（出货前全额付清）'
    case 'NET_30':
      return '票到 30 天'
    case 'NET_60':
      return '票到 60 天'
    default:
      return '票到 90 天'
  }
}
