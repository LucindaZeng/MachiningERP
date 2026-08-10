/**
 * 三方金额一致性（前端 fixture 写死的那条硬规则）：
 *
 * > 开票金额必须与出货单、对账单三者一致；差异需先在对账单处理完再开票。
 *
 * 纯函数。三方指：本申请的不含税合计、所引用出货单的金额合计、
 * 对账单上这些出货单对应的入账金额。任意两者对不上就不放行，
 * 并把差多少写清楚——「不一致」三个字帮不了正在查账的人。
 */
export interface AmountMatchInput {
  /** 本申请的不含税合计 */
  invoiceExTaxMinor: bigint
  /** 引用出货单的金额合计 */
  shipmentTotalMinor: bigint
  /** 对账单上对应的金额；没有关联对账单时为 null，此时只比出货 */
  statementTotalMinor: bigint | null
  currency: string
}

export interface AmountMatchResult {
  matched: boolean
  /** 不一致时可直接展示的说明；一致时为 null */
  note: string | null
}

export function checkAmountMatch(input: AmountMatchInput): AmountMatchResult {
  const differences: string[] = []

  const vsShipment = input.invoiceExTaxMinor - input.shipmentTotalMinor
  if (vsShipment !== 0n) {
    differences.push(`与出货金额相差 ${formatSigned(vsShipment)}`)
  }

  if (input.statementTotalMinor !== null) {
    const vsStatement = input.invoiceExTaxMinor - input.statementTotalMinor
    if (vsStatement !== 0n) {
      differences.push(`与对账单相差 ${formatSigned(vsStatement)}`)
    }
  }

  if (differences.length === 0) return { matched: true, note: null }

  return {
    matched: false,
    note: `${differences.join('；')}（${input.currency} 最小单位）。差异请先在对账单处理完再开票。`,
  }
}

function formatSigned(value: bigint): string {
  return value > 0n ? `+${value}` : value.toString()
}

/**
 * 累计红冲不得超过原票。返回本次还能冲多少（最小货币单位）。
 * 超额红冲会在应收上冲出一个负数，账面上没人能解释那笔钱去哪了。
 */
export function remainingCreditable(
  originalIncTaxMinor: bigint,
  alreadyCreditedMinor: bigint,
): bigint {
  const remaining = originalIncTaxMinor - alreadyCreditedMinor
  return remaining > 0n ? remaining : 0n
}
